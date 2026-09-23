/**
 * ITILSuite Helpdesk Chat - Native Vanilla JS Client
 * Manages WebSockets, live messaging, presence heartbeats, and message-to-ticket conversion.
 */

(function () {
  'use strict';

  const ChatState = {
    socket: null,
    isOpen: false,
    activeConversationId: null,
    activeConversationName: '',
    conversations: [],
    messages: [],
    unreadCount: 0,
    typingTimer: null,
    heartbeatInterval: null,
    reconnectTimer: null,
  };

  // ---------------------------------------------------------------------------
  // 1. Initialization
  // ---------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    initWebSocket();
    loadConversations();
    setupInputListeners();
  });

  // ---------------------------------------------------------------------------
  // 2. WebSocket Connection & Event Routing
  // ---------------------------------------------------------------------------
  function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/chat/ws`;

    const dot = document.getElementById('chat-connection-dot');
    if (dot) {
      dot.className = 'chat-connection-dot connecting';
      dot.title = 'Conectando al servidor de Helpdesk Chat...';
    }

    try {
      ChatState.socket = new WebSocket(wsUrl);

      ChatState.socket.onopen = () => {
        if (dot) {
          dot.className = 'chat-connection-dot connected';
          dot.title = 'Conectado a Helpdesk Chat en vivo';
        }
        startHeartbeat();
      };

      ChatState.socket.onmessage = (event) => {
        try {
          const wsEvent = JSON.parse(event.data);
          handleWsEvent(wsEvent);
        } catch (e) {
          console.error('[Chat] Error parsing WebSocket message', e);
        }
      };

      ChatState.socket.onclose = () => {
        if (dot) {
          dot.className = 'chat-connection-dot disconnected';
          dot.title = 'Desconectado del chat. Reintentando...';
        }
        stopHeartbeat();
        scheduleReconnect();
      };

      ChatState.socket.onerror = () => {
        if (ChatState.socket) ChatState.socket.close();
      };
    } catch (err) {
      console.error('[Chat] Failed to open WebSocket', err);
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (ChatState.reconnectTimer) clearTimeout(ChatState.reconnectTimer);
    ChatState.reconnectTimer = setTimeout(() => {
      initWebSocket();
    }, 4000);
  }

  function startHeartbeat() {
    stopHeartbeat();
    ChatState.heartbeatInterval = setInterval(() => {
      if (ChatState.socket && ChatState.socket.readyState === WebSocket.OPEN) {
        ChatState.socket.send(JSON.stringify({
          type: 'heartbeat',
          payload: { status: 'online' },
        }));
      }
    }, 30000);
  }

  function stopHeartbeat() {
    if (ChatState.heartbeatInterval) {
      clearInterval(ChatState.heartbeatInterval);
      ChatState.heartbeatInterval = null;
    }
  }

  function handleWsEvent(event) {
    if (!event || !event.type) return;

    switch (event.type) {
      case 'new_message': {
        const msg = event.payload;
        if (msg.conversation_id === ChatState.activeConversationId) {
          appendMessageToFeed(msg);
          scrollFeedToBottom();
        } else {
          incrementUnreadBadge();
        }
        updateConversationLastMessage(msg);
        break;
      }
      case 'user_typing': {
        const payload = event.payload;
        if (payload.conversation_id === ChatState.activeConversationId) {
          showTypingIndicator(payload.username);
        }
        break;
      }
      case 'reaction_updated': {
        const payload = event.payload;
        updateMessageReactions(payload.message_id, payload.reactions);
        break;
      }
      case 'ticket_converted': {
        const payload = event.payload;
        showTicketConvertedNotice(payload);
        break;
      }
      case 'presence_updated': {
        // Can be used to update live dots in direct conversations
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Conversations Directory
  // ---------------------------------------------------------------------------
  async function loadConversations() {
    try {
      const res = await fetch('/api/v1/chat/conversations');
      if (!res.ok) return;
      const data = await res.json();
      ChatState.conversations = data;
      renderConversationsList(data);
    } catch (e) {
      console.warn('[Chat] Could not load conversations', e);
    }
  }

  function renderConversationsList(convs) {
    const channelsContainer = document.getElementById('chat-channels-container');
    const directContainer = document.getElementById('chat-direct-container');
    if (!channelsContainer || !directContainer) return;

    channelsContainer.innerHTML = '';
    directContainer.innerHTML = '';

    const channels = convs.filter((c) => c.is_group);
    const direct = convs.filter((c) => !c.is_group);

    if (channels.length === 0) {
      channelsContainer.innerHTML = '<div class="chat-empty-hint">No hay canales activos</div>';
    } else {
      channels.forEach((c) => {
        channelsContainer.appendChild(createConversationItem(c));
      });
    }

    if (direct.length === 0) {
      directContainer.innerHTML = '<div class="chat-empty-hint">Sin conversaciones directas</div>';
    } else {
      direct.forEach((c) => {
        directContainer.appendChild(createConversationItem(c));
      });
    }
  }

  function createConversationItem(conv) {
    const item = document.createElement('div');
    item.className = 'chat-conversation-item';
    item.id = `chat-conv-item-${conv.id}`;
    item.onclick = () => selectConversation(conv.id, conv.name, conv.is_online);

    const icon = conv.is_self ? '📢' : conv.is_group ? '#' : '👤';
    const isOnlineDot = conv.is_online
      ? '<span class="status-dot-inline online"></span>'
      : '';
    const unreadPill =
      conv.unread_count > 0
        ? `<span class="chat-item-unread">${conv.unread_count}</span>`
        : '';

    const snippet = conv.last_message || 'Sin mensajes aún';

    item.innerHTML = `
      <div class="chat-item-avatar">${icon}</div>
      <div class="chat-item-content">
        <div class="chat-item-title-row">
          <span class="chat-item-title">${escapeHtml(conv.name)}</span>
          ${isOnlineDot}
          ${unreadPill}
        </div>
        <div class="chat-item-snippet">${escapeHtml(snippet)}</div>
      </div>
    `;

    return item;
  }

  window.filterConversations = function (query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      renderConversationsList(ChatState.conversations);
      return;
    }
    const filtered = ChatState.conversations.filter((c) =>
      c.name.toLowerCase().includes(q)
    );
    renderConversationsList(filtered);
  };

  // ---------------------------------------------------------------------------
  // 4. Active Thread & Message Handling
  // ---------------------------------------------------------------------------
  window.selectConversation = async function (id, name, isOnline) {
    ChatState.activeConversationId = id;
    ChatState.activeConversationName = name;

    const convView = document.getElementById('chat-conversations-view');
    const msgView = document.getElementById('chat-messages-view');
    const backBtn = document.getElementById('chat-back-btn');
    const headerTitle = document.getElementById('chat-header-title');
    const headerSubtitle = document.getElementById('chat-header-subtitle');
    const activeDot = document.getElementById('chat-active-dot');

    if (convView) convView.style.display = 'none';
    if (msgView) msgView.style.display = 'flex';
    if (backBtn) backBtn.style.display = 'inline-flex';
    if (headerTitle) headerTitle.textContent = name;
    if (headerSubtitle) headerSubtitle.textContent = 'En línea en este canal';
    if (activeDot) activeDot.style.display = isOnline ? 'inline-block' : 'none';

    // Clear and load messages
    const feed = document.getElementById('chat-messages-feed');
    if (feed) {
      feed.innerHTML = '<div class="chat-loading-placeholder">Cargando mensajes...</div>';
    }

    try {
      const res = await fetch(`/api/v1/chat/conversations/${id}/messages?limit=50`);
      if (res.ok) {
        const msgs = await res.json();
        ChatState.messages = msgs;
        renderMessagesFeed(msgs);
        scrollFeedToBottom();
      }
    } catch (e) {
      console.warn('[Chat] Failed to load messages', e);
    }
  };

  window.returnToConversationsList = function () {
    ChatState.activeConversationId = null;
    const convView = document.getElementById('chat-conversations-view');
    const msgView = document.getElementById('chat-messages-view');
    const backBtn = document.getElementById('chat-back-btn');
    const headerTitle = document.getElementById('chat-header-title');
    const headerSubtitle = document.getElementById('chat-header-subtitle');
    const activeDot = document.getElementById('chat-active-dot');

    if (convView) convView.style.display = 'block';
    if (msgView) msgView.style.display = 'none';
    if (backBtn) backBtn.style.display = 'none';
    if (headerTitle) headerTitle.textContent = 'Helpdesk Chat';
    if (headerSubtitle) headerSubtitle.textContent = 'Soporte Técnico en Vivo';
    if (activeDot) activeDot.style.display = 'none';

    loadConversations();
  };

  function renderMessagesFeed(messages) {
    const feed = document.getElementById('chat-messages-feed');
    if (!feed) return;
    feed.innerHTML = '';

    if (messages.length === 0) {
      feed.innerHTML =
        '<div class="chat-empty-hint" style="margin-top: 3rem;">👋 ¡Inicia la conversación! Escribe un mensaje abajo.</div>';
      return;
    }

    messages.forEach((msg) => {
      feed.appendChild(createMessageBubble(msg));
    });
  }

  function createMessageBubble(msg) {
    const div = document.createElement('div');
    div.className = `chat-bubble-wrapper ${msg.is_self ? 'is-self' : 'is-other'}`;
    div.id = `chat-msg-${msg.id}`;

    const dateStr = formatChatDate(msg.created_at);

    // Reconstruct reactions
    let reactionsHtml = '';
    if (msg.reactions && msg.reactions.length > 0) {
      reactionsHtml = `<div class="chat-bubble-reactions">` +
        msg.reactions
          .map(
            (r) =>
              `<button type="button" class="reaction-pill ${r.user_reacted ? 'reacted' : ''}" onclick="toggleMsgReaction('${msg.id}', '${r.emoji}')">${r.emoji} ${r.count}</button>`
          )
          .join('') +
        `</div>`;
    }

    // Convert to Ticket Button (Only for other users' messages and if not already converted)
    let convertBtnHtml = '';
    if (!msg.is_self) {
      if (msg.converted_ticket_id) {
        convertBtnHtml = `
          <a href="/tickets/${msg.converted_ticket_id}" class="chat-ticket-linked-pill" target="_blank" title="Ver ticket vinculado">
            🎫 Ticket #${msg.converted_ticket_number || 'Ver'}
          </a>
        `;
      } else {
        convertBtnHtml = `
          <button type="button" class="chat-convert-btn" onclick="openConvertToTicketModal('${msg.id}', ${JSON.stringify(msg.content)})" title="Convertir mensaje en ticket ITIL">
            🎫 Convertir a Ticket
          </button>
        `;
      }
    }

    div.innerHTML = `
      <div class="chat-bubble-meta">
        <span class="chat-bubble-author">${escapeHtml(msg.sender_name)}</span>
        <span class="chat-bubble-time">${dateStr}</span>
      </div>
      <div class="chat-bubble-content">${formatMessageContent(msg.content)}</div>
      ${convertBtnHtml}
      ${reactionsHtml}
    `;

    return div;
  }

  function appendMessageToFeed(msg) {
    const feed = document.getElementById('chat-messages-feed');
    if (!feed) return;
    const emptyHint = feed.querySelector('.chat-empty-hint');
    if (emptyHint) emptyHint.remove();

    feed.appendChild(createMessageBubble(msg));
  }

  function scrollFeedToBottom() {
    const feed = document.getElementById('chat-messages-feed');
    if (feed) {
      feed.scrollTop = feed.scrollHeight;
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Sending Messages & Typing
  // ---------------------------------------------------------------------------
  window.submitChatMessage = async function (e) {
    if (e) e.preventDefault();
    if (!ChatState.activeConversationId) return;

    const input = document.getElementById('chat-message-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    input.focus();

    try {
      const res = await fetch(`/api/v1/chat/conversations/${ChatState.activeConversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });

      if (!res.ok) {
        console.error('[Chat] Failed to send message', await res.text());
      }
    } catch (err) {
      console.error('[Chat] Network error sending message', err);
    }
  };

  function setupInputListeners() {
    const input = document.getElementById('chat-message-input');
    if (!input) return;

    input.addEventListener('input', () => {
      if (!ChatState.activeConversationId) return;
      if (!ChatState.typingTimer) {
        fetch(`/api/v1/chat/conversations/${ChatState.activeConversationId}/typing`, {
          method: 'POST',
        }).catch(() => {});
      }
      clearTimeout(ChatState.typingTimer);
      ChatState.typingTimer = setTimeout(() => {
        ChatState.typingTimer = null;
      }, 2000);
    });
  }

  function showTypingIndicator(username) {
    const el = document.getElementById('chat-typing-indicator');
    const txt = document.getElementById('chat-typing-text');
    if (!el || !txt) return;

    txt.textContent = `${username} está escribiendo...`;
    el.style.display = 'flex';

    setTimeout(() => {
      el.style.display = 'none';
    }, 2500);
  }

  // ---------------------------------------------------------------------------
  // 6. Emojis & Reactions
  // ---------------------------------------------------------------------------
  window.toggleEmojiTray = function () {
    const tray = document.getElementById('chat-emoji-tray');
    if (tray) {
      tray.style.display = tray.style.display === 'none' ? 'flex' : 'none';
    }
  };

  window.insertEmoji = function (emoji) {
    const input = document.getElementById('chat-message-input');
    if (input) {
      input.value += emoji;
      input.focus();
    }
    const tray = document.getElementById('chat-emoji-tray');
    if (tray) tray.style.display = 'none';
  };

  window.toggleMsgReaction = async function (msgId, emoji) {
    try {
      await fetch(`/api/v1/chat/messages/${msgId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
    } catch (e) {
      console.warn('[Chat] Failed to toggle reaction', e);
    }
  };

  function updateMessageReactions(msgId, reactions) {
    const bubble = document.getElementById(`chat-msg-${msgId}`);
    if (!bubble) return;
    let tray = bubble.querySelector('.chat-bubble-reactions');
    if (!tray) {
      tray = document.createElement('div');
      tray.className = 'chat-bubble-reactions';
      bubble.appendChild(tray);
    }
    tray.innerHTML = reactions
      .map(
        (r) =>
          `<button type="button" class="reaction-pill ${r.user_reacted ? 'reacted' : ''}" onclick="toggleMsgReaction('${msgId}', '${r.emoji}')">${r.emoji} ${r.count}</button>`
      )
      .join('');
  }

  // ---------------------------------------------------------------------------
  // 7. ITIL Action: Convert Message to Ticket
  // ---------------------------------------------------------------------------
  window.openConvertToTicketModal = function (msgId, content) {
    const modal = document.getElementById('convert-ticket-modal');
    const msgIdInput = document.getElementById('convert-message-id');
    const preview = document.getElementById('convert-message-preview');
    const titleInput = document.getElementById('convert-ticket-title');

    if (!modal || !msgIdInput || !preview || !titleInput) return;

    msgIdInput.value = msgId;
    preview.textContent = content;

    // Prepopulate title with first 50 chars of message
    let titleSnippet = content.trim().replace(/\n/g, ' ');
    if (titleSnippet.length > 50) titleSnippet = titleSnippet.substring(0, 47) + '...';
    titleInput.value = titleSnippet || 'Solicitud generada desde Chat';

    updateConvertPriority();
    modal.style.display = 'flex';
  };

  window.closeConvertToTicketModal = function () {
    const modal = document.getElementById('convert-ticket-modal');
    if (modal) modal.style.display = 'none';
  };

  window.updateConvertPriority = function () {
    const u = parseInt(document.getElementById('convert-ticket-urgency')?.value || '3', 10);
    const i = parseInt(document.getElementById('convert-ticket-impact')?.value || '3', 10);

    // ITIL 5x5 Matrix: 1(Very Low) to 5(Major/Critical)
    const raw = Math.round((u + i) / 2);
    const p = Math.max(1, Math.min(5, raw));

    const badge = document.getElementById('convert-priority-badge');
    if (!badge) return;

    badge.className = `priority-badge priority-p${p}`;
    const labels = {
      1: 'P1 - Muy Baja',
      2: 'P2 - Baja',
      3: 'P3 - Media',
      4: 'P4 - Alta',
      5: 'P5 - Crítica / Mayor',
    };
    badge.textContent = labels[p] || 'P3 - Media';
  };

  window.submitConvertToTicket = async function (e) {
    e.preventDefault();
    const msgId = document.getElementById('convert-message-id')?.value;
    const title = document.getElementById('convert-ticket-title')?.value;
    const category = document.getElementById('convert-ticket-category')?.value;
    const urgency = parseInt(document.getElementById('convert-ticket-urgency')?.value || '3', 10);
    const impact = parseInt(document.getElementById('convert-ticket-impact')?.value || '3', 10);
    const btn = document.getElementById('btn-submit-convert');

    if (!msgId || !title) return;

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Creando Ticket...';
    }

    try {
      const res = await fetch(`/api/v1/chat/messages/${msgId}/convert-to-ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: title,
          category,
          urgency,
          impact,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        closeConvertToTicketModal();
        alert(`✓ ¡Ticket ${data.ticket_number} creado con éxito desde el chat!`);
        // Refresh conversation messages to show link
        if (ChatState.activeConversationId) {
          selectConversation(ChatState.activeConversationId, ChatState.activeConversationName);
        }
      } else {
        const err = await res.json();
        alert(`Error al convertir: ${err.error?.message || 'Fallo desconocido'}`);
      }
    } catch (e) {
      alert(`Error de red al conectar con el servidor: ${e.message}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>🎫</span><span>Crear Ticket Ahora</span>';
      }
    }
  };

  function showTicketConvertedNotice(payload) {
    const bubble = document.getElementById(`chat-msg-${payload.message_id}`);
    if (bubble) {
      const btn = bubble.querySelector('.chat-convert-btn');
      if (btn) {
        const link = document.createElement('a');
        link.href = `/tickets/${payload.ticket_id}`;
        link.className = 'chat-ticket-linked-pill';
        link.target = '_blank';
        link.textContent = `🎫 Ticket #${payload.ticket_number}`;
        btn.replaceWith(link);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Launcher & UI Helpers
  // ---------------------------------------------------------------------------
  window.toggleHelpdeskChat = function () {
    const panel = document.getElementById('helpdesk-chat-panel');
    if (!panel) return;
    ChatState.isOpen = !ChatState.isOpen;

    if (ChatState.isOpen) {
      panel.style.display = 'flex';
      clearUnreadBadge();
      if (!ChatState.activeConversationId) {
        loadConversations();
      }
    } else {
      panel.style.display = 'none';
    }
  };

  window.openHelpdeskChat = function (convId) {
    const panel = document.getElementById('helpdesk-chat-panel');
    if (!panel) return;
    ChatState.isOpen = true;
    panel.style.display = 'flex';
    clearUnreadBadge();

    if (convId) {
      const conv = ChatState.conversations.find((c) => c.id === convId);
      selectConversation(convId, conv ? conv.name : 'Soporte');
    } else {
      loadConversations();
    }
  };

  function incrementUnreadBadge() {
    ChatState.unreadCount++;
    const badge = document.getElementById('chat-launcher-badge');
    if (badge) {
      badge.textContent = ChatState.unreadCount;
      badge.style.display = 'inline-flex';
    }
  }

  function clearUnreadBadge() {
    ChatState.unreadCount = 0;
    const badge = document.getElementById('chat-launcher-badge');
    if (badge) {
      badge.style.display = 'none';
    }
  }

  function updateConversationLastMessage(msg) {
    const conv = ChatState.conversations.find((c) => c.id === msg.conversation_id);
    if (conv) {
      conv.last_message = msg.content;
      const snippetEl = document.querySelector(`#chat-conv-item-${conv.id} .chat-item-snippet`);
      if (snippetEl) snippetEl.textContent = msg.content;
    }
  }

  function formatChatDate(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatMessageContent(content) {
    if (!content) return '';
    const escaped = escapeHtml(content);
    // Auto-linkify http(s) URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return escaped.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
