/**
 * WOX-Stream Live Stream Party (Watch Party) API Module
 * Real-time room creation, playback sync, live chat, & emoji reactions.
 */

const { setCorsHeaders, parseToken } = require('./_utils');
const crypto = require('crypto');

// In-memory active rooms store with 24-hour expiration cleanup
const rooms = new Map();

function generateRoomCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `WOX-${code}`;
}

function cleanupExpiredRooms() {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastActive > 24 * 60 * 60 * 1000) {
      rooms.delete(code);
    }
  }
}

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  cleanupExpiredRooms();

  const action = req.query.action || req.body?.action || 'get';
  const tokenStr = req.headers.token || req.query.token || req.body?.token || '';
  const tokenPayload = parseToken(tokenStr);

  try {
    // 1. CREATE STREAM PARTY ROOM
    if (action === 'create') {
      const { mediaId, title, cover, episodeId, episodeName, mediaUrl, hostName, hostAvatar } = req.body || {};

      if (!mediaId || !title) {
        return res.status(400).json({ success: false, error: 'Media ID and Title are required to create a party.' });
      }

      const roomCode = generateRoomCode();
      const hostUser = {
        id: tokenPayload ? tokenPayload.userId : `guest_${Date.now()}`,
        name: hostName || (tokenPayload ? tokenPayload.username : 'Host User'),
        avatar: hostAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(hostName || 'host')}`,
        isHost: true
      };

      const newRoom = {
        code: roomCode,
        hostId: hostUser.id,
        media: {
          id: mediaId,
          title: title,
          cover: cover || '',
          episodeId: episodeId || '',
          episodeName: episodeName || 'Episode 1',
          mediaUrl: mediaUrl || ''
        },
        state: {
          currentTime: 0,
          isPlaying: false,
          updatedAt: Date.now()
        },
        participants: [hostUser],
        messages: [{
          id: `msg_${Date.now()}`,
          sender: 'SYSTEM',
          text: `🎉 Stream Party created! Share code ${roomCode} with friends to watch together.`,
          timestamp: Date.now()
        }],
        reactions: [],
        lastActive: Date.now()
      };

      rooms.set(roomCode, newRoom);

      return res.status(200).json({
        success: true,
        roomCode: roomCode,
        shareUrl: `https://stream.wox.world/?party=${roomCode}`,
        room: newRoom
      });
    }

    // 2. JOIN STREAM PARTY ROOM
    if (action === 'join') {
      const roomCode = (req.query.code || req.body?.code || '').toUpperCase().trim();
      const userName = req.body?.userName || (tokenPayload ? tokenPayload.username : `Guest_${Math.floor(Math.random() * 1000)}`);
      const userAvatar = req.body?.userAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userName)}`;

      if (!roomCode || !rooms.has(roomCode)) {
        return res.status(404).json({ success: false, error: 'Stream Party room not found or expired.' });
      }

      const room = rooms.get(roomCode);
      const userId = tokenPayload ? tokenPayload.userId : `guest_${Date.now()}`;

      let participant = room.participants.find(p => p.id === userId || p.name === userName);
      if (!participant) {
        participant = {
          id: userId,
          name: userName,
          avatar: userAvatar,
          isHost: userId === room.hostId
        };
        room.participants.push(participant);
        room.messages.push({
          id: `msg_${Date.now()}`,
          sender: 'SYSTEM',
          text: `👋 ${userName} joined the Stream Party!`,
          timestamp: Date.now()
        });
      }

      room.lastActive = Date.now();

      return res.status(200).json({
        success: true,
        roomCode: roomCode,
        userId: participant.id,
        isHost: participant.isHost,
        room: room
      });
    }

    // 3. GET ROOM STATE (POLL / SYNC)
    if (action === 'get' || action === 'poll') {
      const roomCode = (req.query.code || req.body?.code || '').toUpperCase().trim();
      const sinceMsg = parseInt(req.query.sinceMsg || '0', 10);
      const sinceReact = parseInt(req.query.sinceReact || '0', 10);

      if (!roomCode || !rooms.has(roomCode)) {
        return res.status(404).json({ success: false, error: 'Room not found.' });
      }

      const room = rooms.get(roomCode);
      room.lastActive = Date.now();

      const newMessages = room.messages.filter(m => m.timestamp > sinceMsg);
      const newReactions = room.reactions.filter(r => r.timestamp > sinceReact);

      return res.status(200).json({
        success: true,
        code: roomCode,
        media: room.media,
        state: room.state,
        hostId: room.hostId,
        participantCount: room.participants.length,
        participants: room.participants,
        messages: newMessages,
        reactions: newReactions
      });
    }

    // 4. SYNC PLAYBACK STATE (HOST CONTROLS)
    if (action === 'sync') {
      const { code, currentTime, isPlaying, episodeId, episodeName, mediaUrl } = req.body || {};
      const roomCode = (code || '').toUpperCase().trim();

      if (!roomCode || !rooms.has(roomCode)) {
        return res.status(404).json({ success: false, error: 'Room not found.' });
      }

      const room = rooms.get(roomCode);
      const userId = tokenPayload ? tokenPayload.userId : req.body?.userId;

      // Only host or authorized participant can sync playback
      room.state = {
        currentTime: parseFloat(currentTime) || 0,
        isPlaying: !!isPlaying,
        updatedAt: Date.now()
      };

      if (episodeId && episodeId !== room.media.episodeId) {
        room.media.episodeId = episodeId;
        if (episodeName) room.media.episodeName = episodeName;
        if (mediaUrl) room.media.mediaUrl = mediaUrl;

        room.messages.push({
          id: `msg_${Date.now()}`,
          sender: 'SYSTEM',
          text: `🎬 Host switched to ${episodeName || 'next episode'}.`,
          timestamp: Date.now()
        });
      }

      room.lastActive = Date.now();

      return res.status(200).json({
        success: true,
        state: room.state
      });
    }

    // 5. SEND LIVE CHAT MESSAGE
    if (action === 'message') {
      const { code, text, senderName, senderAvatar } = req.body || {};
      const roomCode = (code || '').toUpperCase().trim();

      if (!roomCode || !rooms.has(roomCode)) {
        return res.status(404).json({ success: false, error: 'Room not found.' });
      }

      const room = rooms.get(roomCode);
      const msgObj = {
        id: `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        sender: senderName || (tokenPayload ? tokenPayload.username : 'Guest'),
        avatar: senderAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(senderName || 'user')}`,
        text: String(text || '').trim().substring(0, 300),
        timestamp: Date.now()
      };

      room.messages.push(msgObj);
      if (room.messages.length > 100) room.messages.shift();
      room.lastActive = Date.now();

      return res.status(200).json({
        success: true,
        message: msgObj
      });
    }

    // 6. SEND FLOATING EMOJI REACTION
    if (action === 'reaction') {
      const { code, emoji, senderName } = req.body || {};
      const roomCode = (code || '').toUpperCase().trim();

      if (!roomCode || !rooms.has(roomCode)) {
        return res.status(404).json({ success: false, error: 'Room not found.' });
      }

      const room = rooms.get(roomCode);
      const reactionObj = {
        id: `react_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        emoji: emoji || '❤️',
        sender: senderName || 'Guest',
        timestamp: Date.now()
      };

      room.reactions.push(reactionObj);
      if (room.reactions.length > 50) room.reactions.shift();
      room.lastActive = Date.now();

      return res.status(200).json({
        success: true,
        reaction: reactionObj
      });
    }

    return res.status(400).json({ success: false, error: 'Invalid Stream Party action.' });

  } catch (err) {
    console.error('Stream Party API Error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
