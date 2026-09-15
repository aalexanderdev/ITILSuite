import React, { useState, useEffect } from 'react';
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
  ArrowLeft,
  Bell,
} from 'lucide-react';

interface ChatMember {
  id: string;
  name: string;
  email: string;
  isOnline: boolean;
  isCurrentUser: boolean;
  role: string;
}

interface ChatMessage {
  id: string;
  sender: string;
  senderName: string;
  content: string;
  time: string;
  isSelf: boolean;
}

interface ChatItem {
  id: string;
  name: string;
  type: 'group' | 'direct' | 'system';
  unread: number;
  lastMessage: string;
  isOnline?: boolean;
  isPinned?: boolean;
}

interface HelpdeskChatDockProps {
  isOpen: boolean;
  onClose: () => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
}

export const HelpdeskChatWidget: React.FC<HelpdeskChatDockProps> = ({
  isOpen,
  onClose,
  isPinned = true,
  onTogglePin,
}) => {
  const { user } = useAuth();
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');

  // Accordion section collapse states
  const [openOnline, setOpenOnline] = useState(true);
  const [openPinned, setOpenPinned] = useState(true);
  const [openGroups, setOpenGroups] = useState(true);
  const [openDirect, setOpenDirect] = useState(true);

  // Sample conversations aligned with OpenITIL screenshot
  const channels: ChatItem[] = [
    {
      id: 'group-ti',
      name: 'Grupo: Tecnología e Infraestructura (TI)',
      type: 'group',
      unread: 1,
      lastMessage: 'All services operating nominally.',
      isPinned: false,
    },
    {
      id: 'direct-system',
      name: 'Notificaciones del Sistema',
      type: 'system',
      unread: 0,
      lastMessage: 'Bienvenido a ITILSuite Core.',
      isPinned: false,
    },
    {
      id: 'direct-juan',
      name: 'Juan Pérez (Técnico Helpdesk)',
      type: 'direct',
      unread: 2,
      lastMessage: '¿Revisaste el ticket #INC-2026-61469?',
      isOnline: true,
      isPinned: false,
    },
    {
      id: 'direct-sarah',
      name: 'Sarah Connor',
      type: 'direct',
      unread: 0,
      lastMessage: 'Documentación actualizada en KB.',
      isOnline: false,
      isPinned: false,
    },
  ];

  // Group members for the directory sheet (identical to GLPI plugin)
  const groupMembers: ChatMember[] = [
    {
      id: 'user-admin',
      name: user?.display_name || 'System Administrator',
      email: user?.email || 'admin@itilsuite.local',
      isOnline: true,
      isCurrentUser: true,
      role: 'Super-Admin',
    },
    {
      id: 'user-juan',
      name: 'Juan Pérez',
      email: 'juan.perez@itilsuite.local',
      isOnline: true,
      isCurrentUser: false,
      role: 'Técnico',
    },
    {
      id: 'user-laura',
      name: 'Laura Méndez',
      email: 'laura.mendez@itilsuite.local',
      isOnline: true,
      isCurrentUser: false,
      role: 'Técnico',
    },
    {
      id: 'user-carlos',
      name: 'Carlos Gómez',
      email: 'carlos.gomez@itilsuite.local',
      isOnline: false,
      isCurrentUser: false,
      role: 'Soporte N1',
    },
  ];

  // Thread messages
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'user-juan',
      senderName: 'Juan Pérez',
      content: 'Hola! Bienvenidos a la integración nativa de HelpdeskChat en ITILSuite.',
      time: '19:40',
      isSelf: false,
    },
    {
      id: 'msg-2',
      sender: 'user-laura',
      senderName: 'Laura Méndez',
      content: 'El directorio de miembros de grupo está disponible desde el botón de miembros en la cabecera.',
      time: '19:42',
      isSelf: false,
    },
  ]);

  // Handle ESC key to close members or thread
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showMembers) {
          setShowMembers(false);
        } else if (activeConvId) {
          setActiveConvId(null);
        } else if (isOpen) {
          onClose();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showMembers, activeConvId, isOpen, onClose]);

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email).catch(() => {});
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        sender: user?.user_id || 'me',
        senderName: user?.display_name || 'You',
        content: inputMessage.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSelf: true,
      },
    ]);
    setInputMessage('');
  };

  if (!isOpen) return null;

  const currentChannel = channels.find((c) => c.id === activeConvId);

  const onlineMembers = groupMembers.filter((m) => m.isOnline && !m.isCurrentUser);
  const pinnedChannels = channels.filter((c) => c.isPinned);
  const groupChannels = channels.filter((c) => c.type === 'group');
  const directChannels = channels.filter((c) => c.type === 'direct' || c.type === 'system');

  const filterItem = (item: ChatItem) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase());

  return (
    <aside className={`openitil-chat-dock ${isPinned ? 'docked' : 'floating'}`}>
      {/* Dock Header */}
      <div className="chat-dock-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {activeConvId ? (
            <button
              onClick={() => setActiveConvId(null)}
              className="chat-header-icon-btn"
              title="Volver a la lista de conversaciones"
            >
              <ArrowLeft size={16} />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="chat-header-icon-btn"
              title="Cerrar panel de chat"
            >
              <X size={16} />
            </button>
          )}

          <h3 className="chat-dock-title">
            {activeConvId && currentChannel ? currentChannel.name : 'Chat de Soporte'}
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {activeConvId && currentChannel?.type === 'group' && (
            <button
              onClick={() => setShowMembers(true)}
              className={`chat-header-icon-btn ${showMembers ? 'active' : ''}`}
              title="Ver Miembros del Grupo"
            >
              <Users size={16} />
            </button>
          )}

          {onTogglePin && (
            <button
              onClick={onTogglePin}
              className={`chat-header-icon-btn ${isPinned ? 'active' : ''}`}
              title={isPinned ? 'Desanclar del panel' : 'Anclar al panel'}
            >
              <Pin size={15} />
            </button>
          )}
        </div>
      </div>

      {/* View 1: Channel List (OpenITIL Categorized Accordions) */}
      {!activeConvId && (
        <div className="chat-dock-body">
          {/* Search Box */}
          <div className="chat-dock-search">
            <div className="chat-search-pill">
              <Search size={14} color="#9ca3af" />
              <input
                type="text"
                className="chat-search-input"
                placeholder="Buscar conversaciones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="chat-sections-scroll">
            {/* Section 1: En línea */}
            <div className="chat-accordion-section">
              <button
                onClick={() => setOpenOnline(!openOnline)}
                className="chat-accordion-header"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {openOnline ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <span>En línea</span>
                </div>
                <span className="chat-section-badge">{onlineMembers.length}</span>
              </button>

              {openOnline && (
                <div className="chat-accordion-content">
                  {onlineMembers.length === 0 ? (
                    <div className="chat-empty-hint">No hay otros usuarios conectados</div>
                  ) : (
                    onlineMembers.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => setActiveConvId('direct-juan')}
                        className="chat-channel-row"
                      >
                        <span className="status-dot online" />
                        <span className="chat-channel-name">{m.name}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Section 2: Destacados */}
            <div className="chat-accordion-section">
              <button
                onClick={() => setOpenPinned(!openPinned)}
                className="chat-accordion-header"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {openPinned ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <span>Destacados</span>
                </div>
                <span className="chat-section-badge">{pinnedChannels.length}</span>
              </button>

              {openPinned && (
                <div className="chat-accordion-content">
                  {pinnedChannels.length === 0 ? (
                    <div className="chat-empty-hint">No hay conversaciones destacadas</div>
                  ) : (
                    pinnedChannels.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => setActiveConvId(c.id)}
                        className="chat-channel-row"
                      >
                        <span className="chat-channel-name">{c.name}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Section 3: Salas y Departamentos */}
            <div className="chat-accordion-section">
              <button
                onClick={() => setOpenGroups(!openGroups)}
                className="chat-accordion-header"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {openGroups ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <span>Salas y Departamentos</span>
                </div>
                <span className="chat-section-badge">{groupChannels.length}</span>
              </button>

              {openGroups && (
                <div className="chat-accordion-content">
                  {groupChannels.filter(filterItem).map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setActiveConvId(c.id)}
                      className="chat-channel-row"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                        <Users size={14} color="#60a5fa" />
                        <span className="chat-channel-name">{c.name}</span>
                      </div>
                      {c.unread > 0 && <span className="chat-unread-badge">{c.unread}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 4: Conversaciones Directas */}
            <div className="chat-accordion-section">
              <button
                onClick={() => setOpenDirect(!openDirect)}
                className="chat-accordion-header"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {openDirect ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <span>Conversaciones Directas</span>
                </div>
                <span className="chat-section-badge">{directChannels.length}</span>
              </button>

              {openDirect && (
                <div className="chat-accordion-content">
                  {directChannels.filter(filterItem).map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setActiveConvId(c.id)}
                      className="chat-channel-row"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                        {c.type === 'system' ? (
                          <Bell size={14} color="#34d399" />
                        ) : (
                          <MessageCircle size={14} color="#9ca3af" />
                        )}
                        <span className="chat-channel-name">{c.name}</span>
                      </div>
                      {c.unread > 0 && <span className="chat-unread-badge">{c.unread}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View 2: Active Conversation Thread */}
      {activeConvId && (
        <div className="chat-dock-thread">
          <div className="chat-messages-body">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`chat-bubble-wrap ${m.isSelf ? 'self' : 'other'}`}
              >
                {!m.isSelf && <span className="chat-bubble-author">{m.senderName}</span>}
                <div className={`chat-bubble ${m.isSelf ? 'self' : 'other'}`}>
                  {m.content}
                </div>
                <span className="chat-bubble-time">{m.time}</span>
              </div>
            ))}
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="chat-input-bar">
            <input
              type="text"
              placeholder="Escribe un mensaje o :emoji..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="chat-input-field"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="chat-send-btn"
            >
              <Send size={15} />
            </button>
          </form>

          {/* 90% Height Group Member Directory Sheet */}
          {showMembers && (
            <div
              className="chat-members-overlay"
              onClick={() => setShowMembers(false)}
            >
              <div
                className="chat-members-sheet"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="chat-members-header">
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Miembros del Grupo
                    </h4>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {groupMembers.length} integrantes • {groupMembers.filter((m) => m.isOnline).length} en línea
                    </span>
                  </div>
                  <button
                    onClick={() => setShowMembers(false)}
                    className="btn-icon"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div style={{ padding: '0.65rem 0.85rem' }}>
                  <div className="search-box" style={{ width: '100%', padding: '0.35rem 0.65rem' }}>
                    <Search size={14} color="#9ca3af" />
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Buscar miembros o correo..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      style={{ fontSize: '0.78rem' }}
                    />
                  </div>
                </div>

                <div className="chat-members-list">
                  {groupMembers
                    .filter(
                      (m) =>
                        m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                        m.email.toLowerCase().includes(memberSearch.toLowerCase())
                    )
                    .map((member) => (
                      <div key={member.id} className="chat-member-row">
                        <div style={{ position: 'relative' }}>
                          <div className="chat-member-avatar">
                            {member.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span
                            className={`status-dot-avatar ${member.isOnline ? 'online' : 'offline'}`}
                          />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span
                              style={{
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {member.name}
                            </span>
                            {member.isCurrentUser && (
                              <span
                                className="badge badge-blue"
                                style={{ fontSize: '0.62rem', padding: '0.05rem 0.35rem' }}
                              >
                                TÚ
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem' }}>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                color: 'var(--text-secondary)',
                                userSelect: 'text',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {member.email}
                            </span>
                            <button
                              onClick={() => handleCopyEmail(member.email)}
                              className="btn-icon"
                              title="Copiar correo"
                              style={{ padding: '0.15rem', color: copiedEmail === member.email ? '#34d399' : '#9ca3af' }}
                            >
                              {copiedEmail === member.email ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                            {copiedEmail === member.email && (
                              <span style={{ fontSize: '0.65rem', color: '#34d399' }}>¡Copiado!</span>
                            )}
                          </div>
                        </div>

                        {!member.isCurrentUser && (
                          <button
                            onClick={() => {
                              setShowMembers(false);
                              setActiveConvId('direct-juan');
                            }}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.7rem', padding: '0.2rem 0.45rem', height: 24 }}
                            title="Iniciar chat privado"
                          >
                            <MessageSquare size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
