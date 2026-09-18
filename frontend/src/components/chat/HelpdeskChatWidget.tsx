import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  Users,
  Send,
  Copy,
  Check,
  Search,
  MessageCircle,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Pin,
  PinOff,
  ArrowLeft,
  Bell,
  Smile,
  Paperclip,
  Ticket,
  Maximize2,
  Keyboard,
  ExternalLink,
  Star,
  FileText,
  Download,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import type {
  ChatMessage,
  ConversationSummary,
  ChatMember,
  OnlineUser,
  ShortcutButton,
  ConvertToTicketPayload,
  ChatWsEvent,
} from '../../types';
import {
  fetchChatConversations,
  fetchChatMessages,
  sendChatMessage,
  toggleMessageReaction,
  convertMessageToTicket,
  sendPresenceHeartbeat,
  fetchOnlineUsers,
  fetchConversationMembers,
  postChatTyping,
  fetchChatShortcuts,
  toggleChatFeatured,
  getChatWsUrl,
} from '../../services/api';

interface HelpdeskChatDockProps {
  isOpen: boolean;
  onClose: () => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onNavigateTicket?: (ticketId: string) => void;
}

const SHORTCODE_EMOJIS = [
  { shortcode: ':smile', emoji: '😊', label: 'Sonrisa' },
  { shortcode: ':thumbsup', emoji: '👍', label: 'Pulgar arriba' },
  { shortcode: ':like', emoji: '👍', label: 'Me gusta' },
  { shortcode: ':heart', emoji: '❤️', label: 'Corazón' },
  { shortcode: ':corazon', emoji: '❤️', label: 'Corazón' },
  { shortcode: ':rocket', emoji: '🚀', label: 'Cohete' },
  { shortcode: ':fire', emoji: '🔥', label: 'Fuego' },
  { shortcode: ':fuego', emoji: '🔥', label: 'Fuego' },
  { shortcode: ':check', emoji: '✅', label: 'Aprobado' },
  { shortcode: ':warning', emoji: '⚠️', label: 'Alerta' },
  { shortcode: ':eyes', emoji: '👀', label: 'Ojos' },
  { shortcode: ':tada', emoji: '🎉', label: 'Celebración' },
  { shortcode: ':laptop', emoji: '💻', label: 'Computadora' },
  { shortcode: ':gear', emoji: '⚙️', label: 'Configuración' },
  { shortcode: ':ticket', emoji: '🎫', label: 'Ticket' },
  { shortcode: ':star', emoji: '⭐', label: 'Estrella' },
];

const POPULAR_EMOJIS = ['👍', '❤️', '🚀', '👀', '🔥', '✅', '🎉', '💻', '⚙️', '🎫', '⚠️', '⭐'];

export const HelpdeskChatWidget: React.FC<HelpdeskChatDockProps> = ({
  isOpen,
  onClose,
  isPinned = true,
  onTogglePin,
  onNavigateTicket,
}) => {
  const { user } = useAuth();

  // Navigation and view state
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [shortcuts, setShortcuts] = useState<ShortcutButton[]>([]);

  // Search and inputs
  const [searchQuery, setSearchQuery] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Staged Attachment
  const [stagedFile, setStagedFile] = useState<{
    name: string;
    url: string;
    size: number;
    mime: string;
  } | null>(null);

  // Modals & Panels
  const [showMembers, setShowMembers] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [convertTargetMsg, setConvertTargetMsg] = useState<ChatMessage | null>(null);
  const [typingUsers, setTypingUsers] = useState<{ [convId: string]: string }>({});

  // Convert Ticket Form State
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketCategory, setTicketCategory] = useState('Mesa de Ayuda');
  const [ticketUrgency, setTicketUrgency] = useState(3);
  const [ticketImpact, setTicketImpact] = useState(3);
  const [isConverting, setIsConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  // Accordion collapsed states (persisted in localStorage)
  const [openOnline, setOpenOnline] = useState<boolean>(() => {
    return localStorage.getItem('chat_section_online') !== 'false';
  });
  const [openPinned, setOpenPinned] = useState<boolean>(() => {
    return localStorage.getItem('chat_section_pinned') !== 'false';
  });
  const [openGroups, setOpenGroups] = useState<boolean>(() => {
    return localStorage.getItem('chat_section_groups') !== 'false';
  });
  const [openDirect, setOpenDirect] = useState<boolean>(() => {
    return localStorage.getItem('chat_section_direct') !== 'false';
  });

  // Autocomplete popup states
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [shortcodeQuery, setShortcodeQuery] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Toggle accordion persistence
  const toggleSection = (section: 'online' | 'pinned' | 'groups' | 'direct') => {
    if (section === 'online') {
      const next = !openOnline;
      setOpenOnline(next);
      localStorage.setItem('chat_section_online', String(next));
    } else if (section === 'pinned') {
      const next = !openPinned;
      setOpenPinned(next);
      localStorage.setItem('chat_section_pinned', String(next));
    } else if (section === 'groups') {
      const next = !openGroups;
      setOpenGroups(next);
      localStorage.setItem('chat_section_groups', String(next));
    } else if (section === 'direct') {
      const next = !openDirect;
      setOpenDirect(next);
      localStorage.setItem('chat_section_direct', String(next));
    }
  };

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // 1. Initial Data Fetching
  const loadConversations = useCallback(async () => {
    try {
      const [convs, online, suts] = await Promise.all([
        fetchChatConversations(),
        fetchOnlineUsers(),
        fetchChatShortcuts(),
      ]);
      setConversations(convs);
      setOnlineUsers(online);
      setShortcuts(suts);
    } catch {
      // Ignored if offline
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen, loadConversations]);

  // 2. Load Messages when Active Conversation changes
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }

    fetchChatMessages(activeConvId)
      .then((msgs) => {
        setMessages(msgs);
        setTimeout(scrollToBottom, 50);
      })
      .catch(() => {});

    // If group, load members
    const conv = conversations.find((c) => c.id === activeConvId);
    if (conv?.is_group) {
      fetchConversationMembers(activeConvId)
        .then((m) => setMembers(m))
        .catch(() => {});
    }
  }, [activeConvId, conversations, scrollToBottom]);

  // 3. WebSocket Real-Time Subscription
  useEffect(() => {
    if (!isOpen || !user) return;

    let isSubscribed = true;
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connectWs = () => {
      try {
        const url = getChatWsUrl();
        ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          if (!isSubscribed) return;
          try {
            const data = JSON.parse(event.data) as ChatWsEvent;
            if (data.type === 'new_message') {
              const newMsg = data.payload;
              if (newMsg.conversation_id === activeConvId) {
                setMessages((prev) => {
                  if (prev.some((m) => m.id === newMsg.id)) return prev;
                  return [...prev, newMsg];
                });
                setTimeout(scrollToBottom, 50);
              }
              // Update conversations unread & last message
              setConversations((prev) =>
                prev.map((c) => {
                  if (c.id === newMsg.conversation_id) {
                    const isCurrentActive = c.id === activeConvId;
                    return {
                      ...c,
                      last_message: newMsg.content,
                      last_message_time: newMsg.created_at,
                      unread_count: isCurrentActive ? 0 : c.unread_count + 1,
                    };
                  }
                  return c;
                })
              );
            } else if (data.type === 'reaction_updated') {
              const { message_id, reactions } = data.payload;
              setMessages((prev) =>
                prev.map((m) => (m.id === message_id ? { ...m, reactions } : m))
              );
            } else if (data.type === 'user_typing') {
              const { conversation_id, username } = data.payload;
              setTypingUsers((prev) => ({ ...prev, [conversation_id]: username }));
              setTimeout(() => {
                setTypingUsers((prev) => {
                  const copy = { ...prev };
                  delete copy[conversation_id];
                  return copy;
                });
              }, 3000);
            } else if (data.type === 'ticket_converted') {
              const { message_id, ticket_id, ticket_number } = data.payload;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === message_id
                    ? {
                        ...m,
                        converted_ticket_id: ticket_id,
                        converted_ticket_number: ticket_number,
                      }
                    : m
                )
              );
            } else if (data.type === 'presence_updated') {
              fetchOnlineUsers().then(setOnlineUsers).catch(() => {});
            }
          } catch {
            // Ignore malformed WS message
          }
        };

        ws.onclose = () => {
          if (isSubscribed) {
            reconnectTimeout = setTimeout(connectWs, 4000);
          }
        };
      } catch {
        // WebSocket not available
      }
    };

    connectWs();

    // 30s Heartbeat pulse
    const heartbeatInterval = setInterval(() => {
      sendPresenceHeartbeat('online');
    }, 30000);

    return () => {
      isSubscribed = false;
      clearInterval(heartbeatInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
      wsRef.current = null;
    };
  }, [isOpen, user, activeConvId, scrollToBottom]);

  // 4. Keyboard Shortcuts Handling
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Escape stepped back
      if (e.key === 'Escape') {
        if (lightboxImage) {
          setLightboxImage(null);
        } else if (convertTargetMsg) {
          setConvertTargetMsg(null);
        } else if (showShortcutsModal) {
          setShowShortcutsModal(false);
        } else if (showMembers) {
          setShowMembers(false);
        } else if (showEmojiPicker) {
          setShowEmojiPicker(false);
        } else if (activeConvId) {
          setActiveConvId(null);
        } else if (isOpen) {
          onClose();
        }
      }

      // Ctrl + Alt + ? opens shortcuts guide
      if (e.ctrlKey && e.altKey && (e.key === '?' || e.key === '/')) {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    lightboxImage,
    convertTargetMsg,
    showShortcutsModal,
    showMembers,
    showEmojiPicker,
    activeConvId,
    isOpen,
    onClose,
  ]);

  // 5. Input text changes and Autocomplete Triggers
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputMessage(val);

    // Notify typing
    if (activeConvId) {
      if (!typingTimeoutRef.current) {
        postChatTyping(activeConvId);
        typingTimeoutRef.current = setTimeout(() => {
          typingTimeoutRef.current = null;
        }, 2000);
      }
    }

    // Check for :shortcode
    const lastColon = val.lastIndexOf(':');
    if (lastColon !== -1 && lastColon >= val.length - 12 && !val.slice(lastColon).includes(' ')) {
      setShortcodeQuery(val.slice(lastColon).toLowerCase());
    } else {
      setShortcodeQuery(null);
    }

    // Check for @mention (in group)
    const currentConv = conversations.find((c) => c.id === activeConvId);
    if (currentConv?.is_group) {
      const lastAt = val.lastIndexOf('@');
      if (lastAt !== -1 && lastAt >= val.length - 15 && !val.slice(lastAt).includes(' ')) {
        setMentionQuery(val.slice(lastAt + 1).toLowerCase());
      } else {
        setMentionQuery(null);
      }
    } else {
      setMentionQuery(null);
    }
  };

  const applyShortcode = (emoji: string) => {
    if (!shortcodeQuery) return;
    const lastColon = inputMessage.lastIndexOf(':');
    if (lastColon !== -1) {
      const newText = inputMessage.slice(0, lastColon) + emoji + ' ';
      setInputMessage(newText);
      setShortcodeQuery(null);
      textareaRef.current?.focus();
    }
  };

  const applyMention = (username: string) => {
    const lastAt = inputMessage.lastIndexOf('@');
    if (lastAt !== -1) {
      const newText = inputMessage.slice(0, lastAt) + `@${username} `;
      setInputMessage(newText);
      setMentionQuery(null);
      textareaRef.current?.focus();
    }
  };

  // 6. File / Image Attachment handling
  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setStagedFile({
        name: file.name,
        url: reader.result as string,
        size: file.size,
        mime: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          handleFileSelect(file);
          break;
        }
      }
    }
  };

  // 7. Send message submit
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeConvId) return;

    const content = inputMessage.trim();
    if (!content && !stagedFile) return;

    try {
      const newMsg = await sendChatMessage(activeConvId, {
        content: content || (stagedFile ? `[Archivo]: ${stagedFile.name}` : ''),
        attachment_name: stagedFile?.name,
        attachment_url: stagedFile?.url,
        attachment_size: stagedFile?.size,
        attachment_mime: stagedFile?.mime,
      });

      setMessages((prev) => [...prev, newMsg]);
      setInputMessage('');
      setStagedFile(null);
      setShortcodeQuery(null);
      setMentionQuery(null);
      setTimeout(scrollToBottom, 50);
    } catch {
      // Handled
    }
  };

  // 8. Reactions toggle
  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      const updated = await toggleMessageReaction(messageId, emoji);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions: updated } : m))
      );
    } catch {
      // Handled
    }
  };

  // 9. Open Ticket Conversion Modal
  const handleOpenConvert = (msg: ChatMessage) => {
    setConvertTargetMsg(msg);
    setTicketTitle(msg.content.slice(0, 60) || 'Incidencia reportada por chat');
    setTicketCategory('Software');
    setTicketUrgency(3);
    setTicketImpact(3);
    setConvertError(null);
  };

  // 10. Execute Ticket Conversion
  const handleConfirmConvert = async () => {
    if (!convertTargetMsg) return;
    setIsConverting(true);
    setConvertError(null);

    try {
      const payload: ConvertToTicketPayload = {
        name: ticketTitle.trim(),
        category: ticketCategory,
        urgency: ticketUrgency,
        impact: ticketImpact,
        content_override: convertTargetMsg.content,
      };

      const res = await convertMessageToTicket(convertTargetMsg.id, payload);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === convertTargetMsg.id
            ? {
                ...m,
                converted_ticket_id: res.ticket_id,
                converted_ticket_number: res.ticket_number,
              }
            : m
        )
      );

      setConvertTargetMsg(null);
    } catch (err: unknown) {
      setConvertError(err instanceof Error ? err.message : 'Error al convertir a ticket');
    } finally {
      setIsConverting(false);
    }
  };

  // 11. Toggle Favorite/Featured
  const handleToggleFeatured = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await toggleChatFeatured(convId);
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, is_featured: res.is_featured } : c))
      );
    } catch {
      // Handled
    }
  };

  // 12. Copy email helper
  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email).catch(() => {});
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  if (!isOpen) return null;

  const currentConv = conversations.find((c) => c.id === activeConvId);

  // Filtered lists
  const filterItem = (c: ConversationSummary) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase());

  const pinnedConversations = conversations.filter((c) => c.is_featured && filterItem(c));
  const groupConversations = conversations.filter((c) => c.is_group && !c.is_featured && filterItem(c));
  const directConversations = conversations.filter(
    (c) => !c.is_group && !c.is_featured && filterItem(c)
  );

  const filteredOnline = onlineUsers.filter((u) =>
    (u.display_name || u.username).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className={`openitil-chat-dock ${isPinned ? 'docked' : 'floating'}`}>
      {/* ------------------------------------------------------------- */}
      {/* HEADER */}
      {/* ------------------------------------------------------------- */}
      <div className="chat-dock-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          {activeConvId ? (
            <button
              onClick={() => setActiveConvId(null)}
              className="chat-header-icon-btn"
              title="Volver a la lista (Esc)"
            >
              <ArrowLeft size={16} />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="chat-header-icon-btn"
              title="Cerrar panel de chat (Esc)"
            >
              <X size={16} />
            </button>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <h3 className="chat-dock-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeConvId && currentConv ? currentConv.name : 'Mesa de Ayuda • Chat'}
            </h3>
            {activeConvId && currentConv?.is_group && (
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Canal Grupal • {members.length} participantes
              </span>
            )}
            {activeConvId && !currentConv?.is_group && !currentConv?.is_self && currentConv?.is_online && (
              <span style={{ fontSize: '0.68rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                En línea ahora
              </span>
            )}
          </div>
        </div>

        {/* Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {activeConvId && currentConv?.is_group && (
            <button
              onClick={() => setShowMembers(true)}
              className="chat-header-icon-btn"
              title="Ver directorio de miembros"
            >
              <Users size={15} />
            </button>
          )}

          <button
            onClick={() => setShowShortcutsModal(true)}
            className="chat-header-icon-btn"
            title="Atajos de teclado (Ctrl+Alt+?)"
          >
            <Keyboard size={15} />
          </button>

          {onTogglePin && (
            <button
              onClick={onTogglePin}
              className={`chat-header-icon-btn ${isPinned ? 'active-pin' : ''}`}
              title={isPinned ? 'Desacoplar panel (flotante)' : 'Acoplar a la pantalla'}
            >
              {isPinned ? <PinOff size={15} /> : <Pin size={15} />}
            </button>
          )}
        </div>
      </div>

      {/* Floating Shortcut Buttons Toolbar */}
      {shortcuts.length > 0 && !activeConvId && (
        <div className="chat-shortcuts-bar">
          {shortcuts.map((sc) => (
            <a
              key={sc.id}
              href={sc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="chat-shortcut-pill"
              title={sc.url}
            >
              <ExternalLink size={11} />
              <span>{sc.label}</span>
            </a>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CONVERSATION LIST VIEW */}
      {/* ------------------------------------------------------------- */}
      {!activeConvId ? (
        <div className="chat-dock-body">
          {/* Search Box */}
          <div className="chat-search-container">
            <Search size={14} className="chat-search-icon" />
            <input
              type="text"
              placeholder="Buscar conversaciones o usuarios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="chat-search-input"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="chat-conversations-scrollable">
            {/* Section 1: En Línea */}
            {filteredOnline.length > 0 && (
              <div className="chat-accordion-section">
                <button
                  className="chat-accordion-header"
                  onClick={() => toggleSection('online')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {openOnline ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                      USUARIOS EN LÍNEA ({filteredOnline.length})
                    </span>
                  </div>
                </button>

                {openOnline && (
                  <div className="chat-online-users-container">
                    {filteredOnline.map((ou) => (
                      <div
                        key={ou.user_id}
                        className="chat-online-user-chip"
                        title={`${ou.display_name} (${ou.email})`}
                      >
                        <div className="chat-online-avatar">
                          {ou.display_name.charAt(0).toUpperCase()}
                          <span className="online-status-dot"></span>
                        </div>
                        <span className="chat-online-name">{ou.display_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Section 2: Destacados / Pinned */}
            {pinnedConversations.length > 0 && (
              <div className="chat-accordion-section">
                <button
                  className="chat-accordion-header"
                  onClick={() => toggleSection('pinned')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {openPinned ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span>DESTACADOS ⭐ ({pinnedConversations.length})</span>
                  </div>
                </button>

                {openPinned && (
                  <div className="chat-item-group">
                    {pinnedConversations.map((conv) => (
                      <div
                        key={conv.id}
                        className="chat-channel-item"
                        onClick={() => setActiveConvId(conv.id)}
                      >
                        <div className="channel-icon-wrapper pinned">
                          <Star size={14} fill="#f59e0b" color="#f59e0b" />
                        </div>
                        <div className="channel-text-info">
                          <div className="channel-name-row">
                            <span className="channel-title">{conv.name}</span>
                            {conv.last_message_time && (
                              <span className="channel-time">
                                {new Date(conv.last_message_time).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                          <span className="channel-last-msg">
                            {conv.last_message || 'Sin mensajes'}
                          </span>
                        </div>
                        <button
                          className="btn-star-featured active"
                          onClick={(e) => handleToggleFeatured(conv.id, e)}
                          title="Quitar de destacados"
                        >
                          <Star size={13} fill="#f59e0b" color="#f59e0b" />
                        </button>
                        {conv.unread_count > 0 && (
                          <span className="chat-unread-badge">{conv.unread_count}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Section 3: Grupos */}
            <div className="chat-accordion-section">
              <button
                className="chat-accordion-header"
                onClick={() => toggleSection('groups')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {openGroups ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>CANALES GRUPALES ({groupConversations.length})</span>
                </div>
              </button>

              {openGroups && (
                <div className="chat-item-group">
                  {groupConversations.map((conv) => (
                    <div
                      key={conv.id}
                      className="chat-channel-item"
                      onClick={() => setActiveConvId(conv.id)}
                    >
                      <div className="channel-icon-wrapper group">
                        <Users size={14} />
                      </div>
                      <div className="channel-text-info">
                        <div className="channel-name-row">
                          <span className="channel-title">{conv.name}</span>
                          {conv.last_message_time && (
                            <span className="channel-time">
                              {new Date(conv.last_message_time).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                        <span className="channel-last-msg">
                          {conv.last_message || 'Canal de equipo'}
                        </span>
                      </div>
                      <button
                        className="btn-star-featured"
                        onClick={(e) => handleToggleFeatured(conv.id, e)}
                        title="Fijar en destacados"
                      >
                        <Star size={13} />
                      </button>
                      {conv.unread_count > 0 && (
                        <span className="chat-unread-badge">{conv.unread_count}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 4: Directos & Sistema */}
            <div className="chat-accordion-section">
              <button
                className="chat-accordion-header"
                onClick={() => toggleSection('direct')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {openDirect ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>MENSAJES DIRECTOS & AVISOS ({directConversations.length})</span>
                </div>
              </button>

              {openDirect && (
                <div className="chat-item-group">
                  {directConversations.map((conv) => (
                    <div
                      key={conv.id}
                      className="chat-channel-item"
                      onClick={() => setActiveConvId(conv.id)}
                    >
                      <div
                        className={`channel-icon-wrapper ${
                          conv.is_self ? 'system' : 'direct'
                        }`}
                      >
                        {conv.is_self ? (
                          <Bell size={14} />
                        ) : (
                          <MessageSquare size={14} />
                        )}
                      </div>
                      <div className="channel-text-info">
                        <div className="channel-name-row">
                          <span className="channel-title">{conv.name}</span>
                          {conv.is_online && (
                            <span className="online-pill-indicator">●</span>
                          )}
                        </div>
                        <span className="channel-last-msg">
                          {conv.last_message || 'Conversación privada'}
                        </span>
                      </div>
                      <button
                        className="btn-star-featured"
                        onClick={(e) => handleToggleFeatured(conv.id, e)}
                        title="Fijar en destacados"
                      >
                        <Star size={13} />
                      </button>
                      {conv.unread_count > 0 && (
                        <span className="chat-unread-badge">{conv.unread_count}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ------------------------------------------------------------- */
        /* THREAD VIEW */
        /* ------------------------------------------------------------- */
        <div className="chat-dock-thread-container">
          {/* Thread Messages */}
          <div className="chat-thread-scrollable">
            {messages.length === 0 ? (
              <div className="chat-empty-thread">
                <MessageCircle size={32} opacity={0.3} />
                <p>No hay mensajes en esta conversación aún.</p>
                <span>¡Escribe el primer mensaje para iniciar el hilo!</span>
              </div>
            ) : (
              messages.map((msg) => {
                const isSystem = !msg.user_id;

                if (isSystem) {
                  return (
                    <div key={msg.id} className="chat-system-notice-row">
                      <div className="chat-system-notice-badge">
                        <Sparkles size={13} color="#eb4d3d" />
                        <span>{msg.content}</span>
                        {msg.link_url && (
                          <button
                            onClick={() => {
                              const match = msg.link_url?.match(/\/tickets\/([a-f0-9-]+)/i);
                              if (match && onNavigateTicket) {
                                onNavigateTicket(match[1]);
                              }
                            }}
                            className="chat-notice-link-btn"
                          >
                            Ver Ticket <ExternalLink size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`chat-message-row ${msg.is_self ? 'self' : 'other'}`}
                  >
                    <div className="chat-message-bubble">
                      {/* Sender metadata */}
                      <div className="message-sender-header">
                        <span className="message-sender-name">{msg.sender_name}</span>
                        <span className="message-timestamp">
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="message-content-text">{msg.content}</div>

                      {/* Image Attachment Preview */}
                      {msg.attachment_url && msg.attachment_url.startsWith('data:image') && (
                        <div
                          className="chat-image-attachment-wrapper"
                          onClick={() => setLightboxImage(msg.attachment_url!)}
                          title="Click para ampliar imagen"
                        >
                          <img
                            src={msg.attachment_url}
                            alt={msg.attachment_name || 'Adjunto'}
                            className="chat-image-thumbnail"
                          />
                          <div className="chat-image-overlay">
                            <Maximize2 size={14} />
                          </div>
                        </div>
                      )}

                      {/* Non-image File Attachment */}
                      {msg.attachment_url && !msg.attachment_url.startsWith('data:image') && (
                        <div className="chat-file-attachment-pill">
                          <FileText size={16} />
                          <div className="chat-file-info">
                            <span className="chat-file-name">{msg.attachment_name}</span>
                            <span className="chat-file-size">
                              {msg.attachment_size
                                ? `${(msg.attachment_size / 1024).toFixed(1)} KB`
                                : 'Archivo'}
                            </span>
                          </div>
                          <a
                            href={msg.attachment_url}
                            download={msg.attachment_name || 'archivo'}
                            className="chat-file-download-btn"
                            title="Descargar archivo"
                          >
                            <Download size={14} />
                          </a>
                        </div>
                      )}

                      {/* Converted Ticket Badge */}
                      {msg.converted_ticket_number && (
                        <div className="chat-converted-ticket-badge">
                          <Ticket size={12} color="#10b981" />
                          <span>Ticket #{msg.converted_ticket_number}</span>
                          {msg.converted_ticket_id && (
                            <button
                              onClick={() =>
                                onNavigateTicket &&
                                onNavigateTicket(msg.converted_ticket_id!)
                              }
                              className="chat-btn-inspect-ticket"
                            >
                              Abrir
                            </button>
                          )}
                        </div>
                      )}

                      {/* Reaction Summary Pills */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className="chat-reactions-display-bar">
                          {msg.reactions.map((r) => (
                            <button
                              key={r.emoji}
                              onClick={() => handleReaction(msg.id, r.emoji)}
                              className={`reaction-pill ${r.user_reacted ? 'reacted' : ''}`}
                              title={r.user_names.join(', ')}
                            >
                              <span>{r.emoji}</span>
                              <span className="reaction-count">{r.count}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Message Hover Actions */}
                      <div className="message-hover-actions">
                        {/* Reaction Quick Buttons */}
                        <div className="quick-reactions-popover">
                          {['👍', '❤️', '🚀', '👀'].map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleReaction(msg.id, emoji)}
                              className="btn-quick-react"
                              title={`Reaccionar con ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>

                        {/* Convert to Ticket button */}
                        {!msg.converted_ticket_number && (
                          <button
                            onClick={() => handleOpenConvert(msg)}
                            className="btn-convert-ticket-action"
                            title="Convertir este mensaje en Ticket ITIL"
                          >
                            <Ticket size={13} />
                            <span>Crear Ticket</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Live Typing Indicator */}
            {activeConvId && typingUsers[activeConvId] && (
              <div className="chat-typing-indicator-row">
                <span className="typing-dots">● ● ●</span>
                <span>{typingUsers[activeConvId]} está escribiendo...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Autocomplete Popup: :shortcode */}
          {shortcodeQuery && (
            <div className="chat-autocomplete-popover">
              <div className="popover-title">EMOJIS SUGERIDOS</div>
              {SHORTCODE_EMOJIS.filter((s) => s.shortcode.startsWith(shortcodeQuery)).map(
                (item) => (
                  <button
                    key={item.shortcode}
                    className="popover-item"
                    onClick={() => applyShortcode(item.emoji)}
                  >
                    <span className="emoji-glyph">{item.emoji}</span>
                    <span className="shortcode-tag">{item.shortcode}</span>
                    <span className="item-label">{item.label}</span>
                  </button>
                )
              )}
            </div>
          )}

          {/* Autocomplete Popup: @mentions */}
          {mentionQuery !== null && (
            <div className="chat-autocomplete-popover">
              <div className="popover-title">MENCIONAR MIEMBRO</div>
              <button
                className="popover-item"
                onClick={() => applyMention('all')}
              >
                <span className="shortcode-tag">@all</span>
                <span className="item-label">Notificar a todos en el canal</span>
              </button>
              {members
                .filter((m) =>
                  m.username.toLowerCase().includes(mentionQuery) ||
                  m.display_name.toLowerCase().includes(mentionQuery)
                )
                .map((m) => (
                  <button
                    key={m.id}
                    className="popover-item"
                    onClick={() => applyMention(m.username)}
                  >
                    <span className="shortcode-tag">@{m.username}</span>
                    <span className="item-label">{m.display_name}</span>
                  </button>
                ))}
            </div>
          )}

          {/* Staged File Pill Preview */}
          {stagedFile && (
            <div className="chat-staged-file-pill">
              <Paperclip size={14} color="#eb4d3d" />
              <span className="staged-name">{stagedFile.name}</span>
              <span className="staged-size">({(stagedFile.size / 1024).toFixed(0)} KB)</span>
              <button
                onClick={() => setStagedFile(null)}
                className="btn-remove-staged"
                title="Quitar adjunto"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Composer Box */}
          <form onSubmit={handleSendMessage} className="chat-composer-form">
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />

            {/* Formatting & Attachments Bar */}
            <div className="chat-composer-toolbar">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-composer-tool"
                title="Adjuntar archivo o imagen (también podés pegar capturas con Ctrl+V)"
              >
                <Paperclip size={15} />
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="btn-composer-tool"
                  title="Selector de emojis"
                >
                  <Smile size={15} />
                </button>

                {showEmojiPicker && (
                  <div className="chat-emoji-grid-picker">
                    <div className="emoji-grid-title">Reacciones Rápidas</div>
                    <div className="emoji-grid-container">
                      {POPULAR_EMOJIS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          className="emoji-grid-btn"
                          onClick={() => {
                            setInputMessage((prev) => prev + e + ' ');
                            setShowEmojiPicker(false);
                            textareaRef.current?.focus();
                          }}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Character Limit Counter */}
              <div
                className={`chat-char-counter ${
                  inputMessage.length > 1800 ? 'warning' : ''
                }`}
              >
                {inputMessage.length} / 2000
              </div>
            </div>

            {/* Input Row */}
            <div className="chat-input-row">
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="Escribe un mensaje... (:emoji o @mención)"
                value={inputMessage}
                onChange={handleInputChange}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="chat-textarea-input"
                maxLength={2000}
              />

              <button
                type="submit"
                className="btn-send-message"
                disabled={!inputMessage.trim() && !stagedFile}
                title="Enviar mensaje (Enter)"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* AUXILIARY: GROUP MEMBERS DIRECTORY SHEET */}
      {/* ------------------------------------------------------------- */}
      {showMembers && (
        <div className="chat-members-sheet-overlay" onClick={() => setShowMembers(false)}>
          <div className="chat-members-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="members-sheet-header">
              <h4>Directorio del Grupo</h4>
              <button
                onClick={() => setShowMembers(false)}
                className="btn-icon-subtle"
                title="Cerrar (Esc)"
              >
                <X size={16} />
              </button>
            </div>

            <div className="members-sheet-search">
              <Search size={13} className="search-icon" />
              <input
                type="text"
                placeholder="Buscar miembro..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
              />
            </div>

            <div className="members-list-scrollable">
              {members
                .filter(
                  (m) =>
                    m.display_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                    m.username.toLowerCase().includes(memberSearch.toLowerCase())
                )
                .map((m) => (
                  <div key={m.id} className="member-directory-row">
                    <div className="member-avatar">
                      {m.display_name.charAt(0).toUpperCase()}
                      {m.is_online && <span className="online-badge-dot"></span>}
                    </div>

                    <div className="member-info-col">
                      <div className="member-name-row">
                        <span className="name">{m.display_name}</span>
                        <span className="role-pill">{m.role}</span>
                      </div>
                      <span className="email">{m.email}</span>
                    </div>

                    <div className="member-actions-col">
                      <button
                        onClick={() => handleCopyEmail(m.email)}
                        className="btn-copy-email"
                        title="Copiar correo"
                      >
                        {copiedEmail === m.email ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* AUXILIARY: CONVERT TO TICKET MODAL */}
      {/* ------------------------------------------------------------- */}
      {convertTargetMsg && (
        <div className="modal-overlay" onClick={() => setConvertTargetMsg(null)}>
          <div
            className="modal-content chat-convert-modal"
            style={{ maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div className="convert-icon-badge">
                  <Ticket size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Convertir Mensaje a Ticket</h3>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Genera una incidencia formal en ITILSuite vinculada al chat
                  </span>
                </div>
              </div>
              <button
                onClick={() => setConvertTargetMsg(null)}
                className="btn-icon"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            {convertError && (
              <div className="alert-error-bar">
                <AlertCircle size={15} />
                <span>{convertError}</span>
              </div>
            )}

            <div className="convert-form-body">
              {/* Message Quote Preview */}
              <div className="convert-quote-box">
                <span className="quote-sender">{convertTargetMsg.sender_name}:</span>
                <p className="quote-text">"{convertTargetMsg.content}"</p>
                {convertTargetMsg.attachment_name && (
                  <span className="quote-att">📎 Adjunto: {convertTargetMsg.attachment_name}</span>
                )}
              </div>

              {/* Title Field */}
              <div className="form-group">
                <label>Título de la Incidencia *</label>
                <input
                  type="text"
                  value={ticketTitle}
                  onChange={(e) => setTicketTitle(e.target.value)}
                  className="input-field"
                  placeholder="Ej: Falla en enlace de red o software..."
                />
              </div>

              {/* Category */}
              <div className="form-group">
                <label>Categoría ITIL</label>
                <select
                  value={ticketCategory}
                  onChange={(e) => setTicketCategory(e.target.value)}
                  className="select-field"
                >
                  <option value="Mesa de Ayuda">Mesa de Ayuda</option>
                  <option value="Hardware">Hardware / Equipos</option>
                  <option value="Software">Software / Aplicaciones</option>
                  <option value="Redes">Redes e Infraestructura</option>
                  <option value="Accesos">Accesos y Cuentas</option>
                </select>
              </div>

              {/* Urgency & Impact */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Urgencia (1-5)</label>
                  <select
                    value={ticketUrgency}
                    onChange={(e) => setTicketUrgency(Number(e.target.value))}
                    className="select-field"
                  >
                    <option value={1}>1 - Muy Baja</option>
                    <option value={2}>2 - Baja</option>
                    <option value={3}>3 - Media</option>
                    <option value={4}>4 - Alta</option>
                    <option value={5}>5 - Muy Alta / Crítica</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Impacto (1-5)</label>
                  <select
                    value={ticketImpact}
                    onChange={(e) => setTicketImpact(Number(e.target.value))}
                    className="select-field"
                  >
                    <option value={1}>1 - Muy Bajo</option>
                    <option value={2}>2 - Bajo</option>
                    <option value={3}>3 - Medio</option>
                    <option value={4}>4 - Alto</option>
                    <option value={5}>5 - Mayor / Crítico</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setConvertTargetMsg(null)}
                className="btn-secondary"
                disabled={isConverting}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmConvert}
                className="btn-primary"
                disabled={isConverting || !ticketTitle.trim()}
              >
                {isConverting ? 'Creando Ticket...' : 'Confirmar y Crear Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* AUXILIARY: IMAGE LIGHTBOX MODAL */}
      {/* ------------------------------------------------------------- */}
      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightboxImage(null)}
              className="lightbox-close-btn"
              title="Cerrar vista previa (Esc)"
            >
              <X size={20} />
            </button>
            <img src={lightboxImage} alt="Vista previa de adjunto" className="lightbox-img" />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* AUXILIARY: KEYBOARD SHORTCUTS GUIDE MODAL */}
      {/* ------------------------------------------------------------- */}
      {showShortcutsModal && (
        <div className="modal-overlay" onClick={() => setShowShortcutsModal(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Keyboard size={18} color="#eb4d3d" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Atajos de Teclado del Chat</h3>
              </div>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="btn-icon"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="shortcut-guide-row">
                <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>.</kbd>
                <span>Abrir / Cerrar el panel de chat desde cualquier pantalla</span>
              </div>
              <div className="shortcut-guide-row">
                <kbd>Esc</kbd>
                <span>Cerrar lightbox, modal, miembros, hilo o dock</span>
              </div>
              <div className="shortcut-guide-row">
                <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>?</kbd>
                <span>Ver esta guía de atajos de teclado</span>
              </div>
              <div className="shortcut-guide-row">
                <kbd>:shortcode</kbd>
                <span>Autocompletar emojis (ej. :rocket, :fire, :smile)</span>
              </div>
              <div className="shortcut-guide-row">
                <kbd>@usuario</kbd>
                <span>Mencionar miembros en canales grupales</span>
              </div>
              <div className="shortcut-guide-row">
                <kbd>Ctrl</kbd> + <kbd>V</kbd>
                <span>Pegar capturas de pantalla directamente en el mensaje</span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="btn-primary"
                style={{ width: '100%' }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
