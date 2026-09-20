import React, { useState, useEffect } from 'react';
import {
  Mail,
  Inbox,
  FileText,
  Send,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Plus,
  Play,
  Trash2,
  Copy,
  Check,
  Eye,
  Settings,
  ShieldAlert,
  Server,
  Filter,
  Info,
} from 'lucide-react';
import type {
  MailSettings,
  UpdateMailSettingsDto,
  MailReceiver,
  CreateMailReceiverDto,
  MailBlacklist,
  CreateBlacklistDto,
  NotificationTemplate,
  NotificationEvent,
  NotificationQueueItem,
} from '../../types';
import {
  fetchMailSettings,
  updateMailSettings,
  testSmtpConnection,
  fetchMailReceivers,
  createMailReceiver,
  deleteMailReceiver,
  collectFromReceiver,
  fetchMailBlacklists,
  createMailBlacklist,
  deleteMailBlacklist,
  simulateIncomingMail,
  fetchNotificationTemplates,
  updateNotificationTemplate,
  fetchNotificationEvents,
  fetchNotificationQueue,
  retryNotificationQueueItem,
  processNotificationQueueNow,
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';

type TabType = 'smtp' | 'receivers' | 'templates' | 'queue';

export const MailConfigView: React.FC = () => {
  const { activeEntity } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('smtp');

  // ==========================================
  // TAB 1: SMTP Settings State
  // ==========================================
  const [, setSettings] = useState<MailSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<UpdateMailSettingsDto>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // SMTP Test
  const [testEmail, setTestEmail] = useState('');
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // ==========================================
  // TAB 2: Receivers & Blacklists State
  // ==========================================
  const [receivers, setReceivers] = useState<MailReceiver[]>([]);
  const [blacklists, setBlacklists] = useState<MailBlacklist[]>([]);
  const [loadingReceivers, setLoadingReceivers] = useState(false);
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [collectResult, setCollectResult] = useState<any | null>(null);
  const [receiverError, setReceiverError] = useState<string | null>(null);

  // New Receiver Modal/Form
  const [showAddReceiver, setShowAddReceiver] = useState(false);
  const [newReceiverForm, setNewReceiverForm] = useState<Partial<CreateMailReceiverDto>>({
    protocol: 'imap',
    port: 993,
    ssl_mode: 'ssl',
    mail_folder: 'INBOX',
    sync_interval_seconds: 300,
    max_attachment_mb: 10,
    is_active: true,
  });

  // Simulator Form
  const [simSenderEmail, setSimSenderEmail] = useState('empleado.remoto@empresa.com');
  const [simSenderName, setSimSenderName] = useState('Carlos Remoto');
  const [simSubject, setSimSubject] = useState('Problema urgente con mi monitor y VPN');
  const [simBody, setSimBody] = useState('Hola equipo de TI,\n\nDesde esta mañana no puedo conectar mi monitor externo y la VPN se desconecta cada 5 minutos.\n\nSaludos,\nCarlos');
  const [simReceiverId, setSimReceiverId] = useState<string>('');
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any | null>(null);

  // New Blacklist Rule
  const [showAddBlacklist, setShowAddBlacklist] = useState(false);
  const [newBlacklistForm, setNewBlacklistForm] = useState<CreateBlacklistDto>({
    rule_type: 'sender_email',
    pattern: '',
    reason: 'Spam no solicitado',
  });

  // ==========================================
  // TAB 3: Templates & Events State
  // ==========================================
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState<{
    subject_template: string;
    html_template: string;
    text_template: string;
    is_active: boolean;
  }>({
    subject_template: '',
    html_template: '',
    text_template: '',
    is_active: true,
  });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSuccess, setTemplateSuccess] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState(false);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  // ==========================================
  // TAB 4: Queue State
  // ==========================================
  const [queueItems, setQueueItems] = useState<NotificationQueueItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueStatusFilter, setQueueStatusFilter] = useState<string>('');
  const [processingQueue, setProcessingQueue] = useState(false);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [viewingQueueItem, setViewingQueueItem] = useState<NotificationQueueItem | null>(null);

  // ==========================================
  // Data Loaders
  // ==========================================
  const loadSmtpSettings = async () => {
    setLoadingSettings(true);
    setSettingsError(null);
    try {
      const data = await fetchMailSettings();
      setSettings(data);
      setSettingsForm({
        notifications_enabled: data.notifications_enabled,
        email_followups_enabled: data.email_followups_enabled,
        admin_email: data.admin_email,
        admin_name: data.admin_name,
        from_email: data.from_email,
        from_name: data.from_name,
        reply_to_email: data.reply_to_email,
        smtp_host: data.smtp_host,
        smtp_port: data.smtp_port,
        smtp_encryption: data.smtp_encryption,
        smtp_username: data.smtp_username,
        subject_prefix: data.subject_prefix,
        email_signature: data.email_signature,
        max_retries: data.max_retries,
        retry_interval_minutes: data.retry_interval_minutes,
      });
      if (!testEmail && data.admin_email) {
        setTestEmail(data.admin_email);
      }
    } catch (err: any) {
      setSettingsError(err.message || 'Error al cargar configuración SMTP');
    } finally {
      setLoadingSettings(false);
    }
  };

  const loadReceiversData = async () => {
    setLoadingReceivers(true);
    setReceiverError(null);
    try {
      const [recs, bls] = await Promise.all([
        fetchMailReceivers(),
        fetchMailBlacklists(),
      ]);
      setReceivers(recs);
      setBlacklists(bls);
      if (recs.length > 0 && !simReceiverId) {
        setSimReceiverId(recs[0].id);
      }
    } catch (err: any) {
      setReceiverError(err.message || 'Error al cargar colectores');
    } finally {
      setLoadingReceivers(false);
    }
  };

  const loadTemplatesData = async () => {
    try {
      const [tpls, evts] = await Promise.all([
        fetchNotificationTemplates(),
        fetchNotificationEvents(),
      ]);
      setTemplates(tpls);
      setEvents(evts);
      if (tpls.length > 0 && !selectedTemplate) {
        setSelectedTemplate(tpls[0]);
        setTemplateForm({
          subject_template: tpls[0].subject_template,
          html_template: tpls[0].html_template,
          text_template: tpls[0].text_template,
          is_active: tpls[0].is_active,
        });
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const loadQueueData = async () => {
    setLoadingQueue(true);
    try {
      const items = await fetchNotificationQueue(queueStatusFilter || undefined);
      setQueueItems(items);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'smtp') loadSmtpSettings();
    if (activeTab === 'receivers') loadReceiversData();
    if (activeTab === 'templates') loadTemplatesData();
    if (activeTab === 'queue') loadQueueData();
  }, [activeTab, queueStatusFilter]);

  // Handle Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess(null);
    setSettingsError(null);
    try {
      const updated = await updateMailSettings(settingsForm);
      setSettings(updated);
      setSettingsSuccess('Configuración de correo y SMTP guardada exitosamente.');
      setTimeout(() => setSettingsSuccess(null), 4000);
    } catch (err: any) {
      setSettingsError(err.message || 'Error al actualizar configuración');
    } finally {
      setSavingSettings(false);
    }
  };

  // Handle Test SMTP
  const handleTestSmtp = async () => {
    if (!testEmail) return;
    setTestingSmtp(true);
    setTestResult(null);
    try {
      const res = await testSmtpConnection({
        to_email: testEmail,
        custom_smtp_host: settingsForm.smtp_host,
        custom_smtp_port: settingsForm.smtp_port,
      });
      setTestResult({ success: true, message: res.message });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Fallo en la prueba SMTP' });
    } finally {
      setTestingSmtp(false);
    }
  };

  // Handle Collect
  const handleCollectNow = async (id: string) => {
    setCollectingId(id);
    setCollectResult(null);
    try {
      const res = await collectFromReceiver(id);
      setCollectResult(res);
      loadReceiversData();
    } catch (err: any) {
      alert(`Error en recolección: ${err.message}`);
    } finally {
      setCollectingId(null);
    }
  };

  // Handle Create Receiver
  const handleCreateReceiver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReceiverForm.name || !newReceiverForm.host || !newReceiverForm.username) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }
    try {
      await createMailReceiver({
        entity_id: activeEntity.id,
        name: newReceiverForm.name!,
        protocol: newReceiverForm.protocol || 'imap',
        host: newReceiverForm.host!,
        port: Number(newReceiverForm.port) || 993,
        ssl_mode: newReceiverForm.ssl_mode || 'ssl',
        username: newReceiverForm.username!,
        password: newReceiverForm.password,
        mail_folder: newReceiverForm.mail_folder || 'INBOX',
        archive_folder: newReceiverForm.archive_folder,
        refused_folder: newReceiverForm.refused_folder,
        max_attachment_mb: newReceiverForm.max_attachment_mb,
        is_active: newReceiverForm.is_active,
        sync_interval_seconds: newReceiverForm.sync_interval_seconds,
      });
      setShowAddReceiver(false);
      loadReceiversData();
    } catch (err: any) {
      alert(`Error al crear colector: ${err.message}`);
    }
  };

  // Handle Delete Receiver
  const handleDeleteReceiver = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar el colector de correo "${name}"?`)) return;
    try {
      await deleteMailReceiver(id);
      loadReceiversData();
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  // Handle Simulation
  const handleSimulateIncoming = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulating(true);
    setSimResult(null);
    try {
      const res = await simulateIncomingMail({
        from_email: simSenderEmail,
        from_name: simSenderName,
        subject: simSubject,
        body: simBody,
        receiver_id: simReceiverId || undefined,
      });
      setSimResult(res.result);
      loadReceiversData();
    } catch (err: any) {
      alert(`Error en simulación: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  };

  // Handle Create Blacklist
  const handleCreateBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlacklistForm.pattern) return;
    try {
      await createMailBlacklist(newBlacklistForm);
      setShowAddBlacklist(false);
      setNewBlacklistForm({ rule_type: 'sender_email', pattern: '', reason: '' });
      loadReceiversData();
    } catch (err: any) {
      alert(`Error al crear regla: ${err.message}`);
    }
  };

  const handleDeleteBlacklist = async (id: string) => {
    if (!confirm('¿Eliminar esta regla de lista negra?')) return;
    try {
      await deleteMailBlacklist(id);
      loadReceiversData();
    } catch (err: any) {
      alert(`Error al eliminar regla: ${err.message}`);
    }
  };

  // Handle Save Template
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    setSavingTemplate(true);
    setTemplateSuccess(null);
    try {
      const updated = await updateNotificationTemplate(selectedTemplate.id, {
        subject_template: templateForm.subject_template,
        html_template: templateForm.html_template,
        text_template: templateForm.text_template,
        is_active: templateForm.is_active,
      });
      setSelectedTemplate(updated);
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setTemplateSuccess('Plantilla guardada correctamente');
      setTimeout(() => setTemplateSuccess(null), 3000);
    } catch (err: any) {
      alert(`Error al guardar plantilla: ${err.message}`);
    } finally {
      setSavingTemplate(false);
    }
  };

  // Handle Copy Tag
  const handleCopyTag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  // Handle Retry Queue
  const handleRetryQueueItem = async (id: string) => {
    try {
      await retryNotificationQueueItem(id);
      loadQueueData();
    } catch (err: any) {
      alert(`Error al reintentar: ${err.message}`);
    }
  };

  // Handle Process Queue Now
  const handleProcessQueueNow = async () => {
    setProcessingQueue(true);
    setQueueMessage(null);
    try {
      const res = await processNotificationQueueNow();
      setQueueMessage(res.message);
      loadQueueData();
      setTimeout(() => setQueueMessage(null), 4000);
    } catch (err: any) {
      alert(`Error al procesar cola: ${err.message}`);
    } finally {
      setProcessingQueue(false);
    }
  };

  return (
    <div className="mail-config-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Header Card */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Mail size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
              Notificaciones y Colectores de Correo
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              Motor de correo empresarial ITIL: Servidor SMTP, Ingestión IMAP/POP3, Plantillas y Cola de Envíos
            </p>
          </div>
        </div>

        {/* Global Quick Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => {
              if (activeTab === 'smtp') loadSmtpSettings();
              if (activeTab === 'receivers') loadReceiversData();
              if (activeTab === 'templates') loadTemplatesData();
              if (activeTab === 'queue') loadQueueData();
            }}
            className="btn btn-secondary"
            title="Refrescar datos"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
          >
            <RefreshCw size={14} className={loadingSettings || loadingReceivers || loadingQueue ? 'spin' : ''} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="mail-nav-tabs">
        <button
          onClick={() => setActiveTab('smtp')}
          className={`mail-nav-tab ${activeTab === 'smtp' ? 'active' : ''}`}
        >
          <Settings size={15} />
          <span>Servidor SMTP</span>
        </button>

        <button
          onClick={() => setActiveTab('receivers')}
          className={`mail-nav-tab ${activeTab === 'receivers' ? 'active' : ''}`}
        >
          <Inbox size={15} />
          <span>Colectores (Receivers)</span>
          {receivers.length > 0 && <span className="tab-counter-badge">{receivers.length}</span>}
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className={`mail-nav-tab ${activeTab === 'templates' ? 'active' : ''}`}
        >
          <FileText size={15} />
          <span>Plantillas (Gabarits)</span>
          {templates.length > 0 && <span className="tab-counter-badge">{templates.length}</span>}
        </button>

        <button
          onClick={() => setActiveTab('queue')}
          className={`mail-nav-tab ${activeTab === 'queue' ? 'active' : ''}`}
        >
          <Send size={15} />
          <span>Cola de Envíos</span>
          {queueItems.length > 0 && <span className="tab-counter-badge">{queueItems.length}</span>}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SMTP SETTINGS */}
      {/* ========================================================================= */}
      {activeTab === 'smtp' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.25rem' }}>
          {/* Main SMTP Config Form */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Server size={16} color="#3b82f6" />
              Configuración del Servidor de Correo Saliente (SMTP)
            </h3>

            {settingsSuccess && (
              <div className="alert-banner success" style={{ marginBottom: '1rem' }}>
                <CheckCircle2 size={16} />
                <span>{settingsSuccess}</span>
              </div>
            )}

            {settingsError && (
              <div className="alert-banner error" style={{ marginBottom: '1rem' }}>
                <AlertTriangle size={16} />
                <span>{settingsError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Switches */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '0.85rem', backgroundColor: 'var(--card-subtle-bg)', borderRadius: 'var(--radius-sm)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                  <input
                    type="checkbox"
                    checked={settingsForm.notifications_enabled ?? true}
                    onChange={(e) => setSettingsForm({ ...settingsForm, notifications_enabled: e.target.checked })}
                  />
                  <span>Habilitar notificaciones por correo</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                  <input
                    type="checkbox"
                    checked={settingsForm.email_followups_enabled ?? true}
                    onChange={(e) => setSettingsForm({ ...settingsForm, email_followups_enabled: e.target.checked })}
                  />
                  <span>Permitir responder por correo (Followups)</span>
                </label>
              </div>

              {/* Host & Port */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">Servidor SMTP (Host)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settingsForm.smtp_host ?? ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, smtp_host: e.target.value })}
                    placeholder="smtp.empresa.com o localhost"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Puerto</label>
                  <input
                    type="number"
                    className="form-input"
                    value={settingsForm.smtp_port ?? 587}
                    onChange={(e) => setSettingsForm({ ...settingsForm, smtp_port: Number(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Cifrado</label>
                  <select
                    className="form-input"
                    value={settingsForm.smtp_encryption ?? 'tls'}
                    onChange={(e) => setSettingsForm({ ...settingsForm, smtp_encryption: e.target.value })}
                  >
                    <option value="none">Ninguno</option>
                    <option value="ssl">SSL / TLS (465)</option>
                    <option value="tls">STARTTLS (587)</option>
                  </select>
                </div>
              </div>

              {/* Username & Password */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">Usuario SMTP</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settingsForm.smtp_username ?? ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, smtp_username: e.target.value })}
                    placeholder="soporte@empresa.com"
                  />
                </div>
                <div>
                  <label className="form-label">Contraseña SMTP</label>
                  <input
                    type="password"
                    className="form-input"
                    value={settingsForm.smtp_password ?? ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, smtp_password: e.target.value })}
                    placeholder="••••••••••••"
                  />
                </div>
              </div>

              {/* Sender info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">Nombre del Remitente</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settingsForm.from_name ?? ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, from_name: e.target.value })}
                    placeholder="ITILSuite Mesa de Ayuda"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Dirección de Remitente (From)</label>
                  <input
                    type="email"
                    className="form-input"
                    value={settingsForm.from_email ?? ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, from_email: e.target.value })}
                    placeholder="noreply-helpdesk@empresa.com"
                    required
                  />
                </div>
              </div>

              {/* Reply To & Prefix */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">Responder a (Reply-To)</label>
                  <input
                    type="email"
                    className="form-input"
                    value={settingsForm.reply_to_email ?? ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, reply_to_email: e.target.value })}
                    placeholder="helpdesk@empresa.com"
                  />
                </div>
                <div>
                  <label className="form-label">Prefijo del Asunto</label>
                  <input
                    type="text"
                    className="form-input"
                    value={settingsForm.subject_prefix ?? ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, subject_prefix: e.target.value })}
                    placeholder="[ITILSuite]"
                  />
                </div>
              </div>

              {/* Signature */}
              <div>
                <label className="form-label">Firma del Correo (HTML / Texto)</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={settingsForm.email_signature ?? ''}
                  onChange={(e) => setSettingsForm({ ...settingsForm, email_signature: e.target.value })}
                  placeholder="-- &#10;Mesa de Ayuda ITILSuite | Soporte TI Corporativo"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                />
              </div>

              {/* Submit */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <CheckCircle2 size={16} />
                  <span>{savingSettings ? 'Guardando...' : 'Guardar Configuración'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Diagnostic & Test Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* SMTP Test Card */}
            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Send size={16} color="#10b981" />
                Prueba de Conexión y Envío
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Envía un correo de comprobación para verificar que el servidor SMTP acepte conexiones y autenticación.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">Destinatario de Prueba</label>
                  <input
                    type="email"
                    className="form-input"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="admin@empresa.com"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleTestSmtp}
                  disabled={testingSmtp || !testEmail}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <Send size={14} className={testingSmtp ? 'spin' : ''} />
                  <span>{testingSmtp ? 'Enviando prueba...' : 'Enviar Correo de Prueba'}</span>
                </button>

                {testResult && (
                  <div
                    className={`alert-banner ${testResult.success ? 'success' : 'error'}`}
                    style={{ marginTop: '0.5rem' }}
                  >
                    {testResult.success ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span style={{ fontSize: '0.78rem' }}>{testResult.message}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Notifications Notice */}
            <div className="card" style={{ borderLeft: '4px solid #3b82f6' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <Info size={16} color="#3b82f6" />
                Paridad Funcional ITSM / ITIL
              </h4>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                En <strong>ITILSuite</strong>, los correos se envían de forma asíncrona mediante una cola persistente con reintentos automáticos gestionados por un proceso en segundo plano de Tokio, garantizando cero retrasos en la respuesta HTTP de la mesa de tickets.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RECEIVERS (COLLECTORS) & BLACKLISTS */}
      {/* ========================================================================= */}
      {activeTab === 'receivers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Receivers Header & Actions */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                Colectores de Correo Entrante (IMAP / POP3)
              </h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                Ingestión automática de tickets y respuestas mediante buzones de soporte dedicados
              </p>
            </div>
            <button
              onClick={() => setShowAddReceiver(!showAddReceiver)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
            >
              <Plus size={15} />
              <span>{showAddReceiver ? 'Cerrar Formulario' : 'Nuevo Colector'}</span>
            </button>
          </div>

          {receiverError && (
            <div className="alert-banner error">
              <AlertTriangle size={16} />
              <span>{receiverError}</span>
            </div>
          )}

          {collectResult && (
            <div className="alert-banner success" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <CheckCircle2 size={18} style={{ marginTop: '0.1rem', flexShrink: 0 }} />
              <div>
                <strong>Resultado de Recolección ({collectResult.receiver_name}):</strong>
                <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  {collectResult.message} — Tickets Creados: <strong>{collectResult.tickets_created}</strong>, Seguimientos Agregados: <strong>{collectResult.followups_added}</strong>, Excluidos por Lista Negra: <strong>{collectResult.rejected_blacklisted}</strong>.
                </div>
              </div>
            </div>
          )}

          {/* New Receiver Form Drawer */}
          {showAddReceiver && (
            <div className="card" style={{ border: '1px solid var(--accent-blue)', animation: 'fadeIn 0.2s ease' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem' }}>
                Registrar Nuevo Colector de Correo
              </h4>
              <form onSubmit={handleCreateReceiver} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="form-label">Nombre del Colector</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newReceiverForm.name ?? ''}
                      onChange={(e) => setNewReceiverForm({ ...newReceiverForm, name: e.target.value })}
                      placeholder="Mesa de Ayuda Principal"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Protocolo</label>
                    <select
                      className="form-input"
                      value={newReceiverForm.protocol}
                      onChange={(e) => setNewReceiverForm({ ...newReceiverForm, protocol: e.target.value })}
                    >
                      <option value="imap">IMAP (Recomendado)</option>
                      <option value="pop3">POP3</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Modo SSL</label>
                    <select
                      className="form-input"
                      value={newReceiverForm.ssl_mode}
                      onChange={(e) => setNewReceiverForm({ ...newReceiverForm, ssl_mode: e.target.value })}
                    >
                      <option value="ssl">SSL / TLS (993)</option>
                      <option value="tls">STARTTLS</option>
                      <option value="none">Sin cifrado</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1.5fr', gap: '0.75rem' }}>
                  <div>
                    <label className="form-label">Servidor (Host)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newReceiverForm.host ?? ''}
                      onChange={(e) => setNewReceiverForm({ ...newReceiverForm, host: e.target.value })}
                      placeholder="imap.empresa.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Puerto</label>
                    <input
                      type="number"
                      className="form-input"
                      value={newReceiverForm.port ?? 993}
                      onChange={(e) => setNewReceiverForm({ ...newReceiverForm, port: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Usuario / Buzón</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newReceiverForm.username ?? ''}
                      onChange={(e) => setNewReceiverForm({ ...newReceiverForm, username: e.target.value })}
                      placeholder="soporte@empresa.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Contraseña</label>
                    <input
                      type="password"
                      className="form-input"
                      value={newReceiverForm.password ?? ''}
                      onChange={(e) => setNewReceiverForm({ ...newReceiverForm, password: e.target.value })}
                      placeholder="••••••••••••"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="form-label">Carpeta Origen</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newReceiverForm.mail_folder ?? 'INBOX'}
                      onChange={(e) => setNewReceiverForm({ ...newReceiverForm, mail_folder: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Carpeta Archivo (opcional)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newReceiverForm.archive_folder ?? ''}
                      onChange={(e) => setNewReceiverForm({ ...newReceiverForm, archive_folder: e.target.value })}
                      placeholder="Archive o Procesados"
                    />
                  </div>
                  <div>
                    <label className="form-label">Frecuencia Sync (segundos)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={newReceiverForm.sync_interval_seconds ?? 300}
                      onChange={(e) => setNewReceiverForm({ ...newReceiverForm, sync_interval_seconds: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddReceiver(false)}
                    className="btn btn-secondary"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Crear Colector
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Receivers Table */}
          <div className="tickets-table-container">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th>Nombre & Ámbito</th>
                  <th>Protocolo & Servidor</th>
                  <th>Buzón / Carpeta</th>
                  <th>Estado</th>
                  <th>Última Sincronización</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {receivers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No hay colectores de correo configurados en esta entidad.
                    </td>
                  </tr>
                ) : (
                  receivers.map((rec) => (
                    <tr key={rec.id} className="ticket-row" style={{ cursor: 'default' }}>
                      <td>
                        <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{rec.name}</strong>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{rec.entity_name || 'Global'}</span>
                      </td>
                      <td>
                        <span className="protocol-badge">{rec.protocol.toUpperCase()}</span>{' '}
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                          {rec.host}:{rec.port} ({rec.ssl_mode})
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.78rem' }}>
                          <span>{rec.username}</span>
                          <span style={{ color: 'var(--text-muted)', marginLeft: '0.3rem' }}>/ {rec.mail_folder}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill ${rec.is_active ? 'active' : 'inactive'}`}>
                          {rec.is_active ? 'Activo' : 'Pausado'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {rec.last_sync_at ? new Date(rec.last_sync_at).toLocaleString() : 'Pendiente primera ejecución'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          <button
                            onClick={() => handleCollectNow(rec.id)}
                            disabled={collectingId === rec.id}
                            className="btn btn-secondary btn-sm"
                            title="Ejecutar recolección ahora"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                          >
                            <Play size={13} className={collectingId === rec.id ? 'spin' : ''} />
                            <span>{collectingId === rec.id ? 'Leyendo...' : 'Recolectar'}</span>
                          </button>
                          <button
                            onClick={() => handleDeleteReceiver(rec.id, rec.name)}
                            className="btn btn-icon btn-sm text-danger"
                            title="Eliminar colector"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Split 2-Columns: Incoming Email Simulator & Blacklists */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.25rem' }}>
            {/* INCOMING EMAIL SIMULATOR (Great for air-gapped dev / offline demo) */}
            <div className="card" style={{ border: '1px dashed var(--border-active)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                  <Inbox size={16} color="#3b82f6" />
                  Simulador de Ingestión de Correo Entrante
                </h4>
                <span className="badge badge-outline" style={{ fontSize: '0.7rem' }}>Entorno Local / Air-Gap</span>
              </div>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Prueba el motor de ingestión sin un servidor de correo externo. Simula nuevos tickets o respuestas en hilos existentes (ej: incluir <code>[#INC-2026-XXXX]</code> en el asunto).
              </p>

              <form onSubmit={handleSimulateIncoming} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  <div>
                    <label className="form-label">Remitente (Email)</label>
                    <input
                      type="email"
                      className="form-input"
                      value={simSenderEmail}
                      onChange={(e) => setSimSenderEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Nombre del Remitente</label>
                    <input
                      type="text"
                      className="form-input"
                      value={simSenderName}
                      onChange={(e) => setSimSenderName(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Asunto del Correo</label>
                  <input
                    type="text"
                    className="form-input"
                    value={simSubject}
                    onChange={(e) => setSimSubject(e.target.value)}
                    placeholder="Escribe [#INC-2026-0009] para añadir seguimiento o un asunto nuevo para crear ticket"
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Cuerpo del Mensaje</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={simBody}
                    onChange={(e) => setSimBody(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                  <select
                    className="form-input"
                    style={{ width: 'auto', fontSize: '0.78rem' }}
                    value={simReceiverId}
                    onChange={(e) => setSimReceiverId(e.target.value)}
                  >
                    {receivers.map((r) => (
                      <option key={r.id} value={r.id}>
                        Buzón: {r.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="submit"
                    disabled={simulating}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Play size={14} className={simulating ? 'spin' : ''} />
                    <span>{simulating ? 'Procesando...' : 'Inyectar Correo de Prueba'}</span>
                  </button>
                </div>
              </form>

              {simResult && (
                <div
                  className="card-subtle"
                  style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#34d399', fontWeight: 600, marginBottom: '0.3rem' }}>
                    <CheckCircle2 size={15} />
                    <span>Ingestión Procesada Exitosamente</span>
                  </div>
                  <div>Acción: <strong>{simResult.action}</strong></div>
                  {simResult.ticket_number && (
                    <div>Número de Ticket: <strong style={{ color: '#60a5fa' }}>{simResult.ticket_number}</strong></div>
                  )}
                  {simResult.matched_code && (
                    <div>Ticket Emparejado por Asunto: <strong>{simResult.matched_code}</strong></div>
                  )}
                  {simResult.reason && (
                    <div style={{ color: '#f87171' }}>Motivo de exclusión: {simResult.reason}</div>
                  )}
                </div>
              )}
            </div>

            {/* BLACKLISTS / ANTI-SPAM */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                  <ShieldAlert size={16} color="#f43f5e" />
                  Listas Negras Anti-Spam
                </h4>
                <button
                  onClick={() => setShowAddBlacklist(!showAddBlacklist)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.72rem' }}
                >
                  {showAddBlacklist ? 'Cerrar' : '+ Regla'}
                </button>
              </div>

              {showAddBlacklist && (
                <form onSubmit={handleCreateBlacklist} style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--card-subtle-bg)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <div>
                      <label className="form-label">Tipo</label>
                      <select
                        className="form-input"
                        value={newBlacklistForm.rule_type}
                        onChange={(e) => setNewBlacklistForm({ ...newBlacklistForm, rule_type: e.target.value })}
                      >
                        <option value="sender_email">Email exacto</option>
                        <option value="domain">Dominio (@spam.com)</option>
                        <option value="subject_regex">Regex en Asunto</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Patrón</label>
                      <input
                        type="text"
                        className="form-input"
                        value={newBlacklistForm.pattern}
                        onChange={(e) => setNewBlacklistForm({ ...newBlacklistForm, pattern: e.target.value })}
                        placeholder="ej: noreply@bot.com o spam.net"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Motivo</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newBlacklistForm.reason ?? ''}
                      onChange={(e) => setNewBlacklistForm({ ...newBlacklistForm, reason: e.target.value })}
                      placeholder="Motivo de bloqueo"
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button type="submit" className="btn btn-primary btn-sm">Guardar Regla</button>
                  </div>
                </form>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '350px', overflowY: 'auto' }}>
                {blacklists.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                    No hay reglas de exclusión activas.
                  </div>
                ) : (
                  blacklists.map((b) => (
                    <div
                      key={b.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.55rem 0.75rem',
                        backgroundColor: 'var(--card-subtle-bg)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.78rem',
                      }}
                    >
                      <div>
                        <span className="badge badge-subtle" style={{ marginRight: '0.4rem' }}>{b.rule_type}</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{b.pattern}</strong>
                        {b.reason && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{b.reason}</div>}
                      </div>
                      <button
                        onClick={() => handleDeleteBlacklist(b.id)}
                        className="btn-icon btn-sm text-danger"
                        title="Eliminar regla"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: TEMPLATES & NOTIFICATION EVENTS */}
      {/* ========================================================================= */}
      {activeTab === 'templates' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.25rem' }}>
          {/* Left Sidebar: Template Selection & Event Mappings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Templates List */}
            <div className="card" style={{ padding: '0.75rem' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', paddingLeft: '0.5rem' }}>
                Plantillas de Correo
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {templates.map((tpl) => {
                  const isSelected = selectedTemplate?.id === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => {
                        setSelectedTemplate(tpl);
                        setTemplateForm({
                          subject_template: tpl.subject_template,
                          html_template: tpl.html_template,
                          text_template: tpl.text_template,
                          is_active: tpl.is_active,
                        });
                      }}
                      className={`template-list-item ${isSelected ? 'active' : ''}`}
                    >
                      <FileText size={15} color={isSelected ? '#3b82f6' : '#9ca3af'} />
                      <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                        <div style={{ fontWeight: isSelected ? 600 : 500, fontSize: '0.82rem', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                          {tpl.name}
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Tipo: {tpl.item_type}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Event Mappings Table */}
            <div className="card" style={{ padding: '0.75rem' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
                Destinatarios por Evento
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.74rem' }}>
                {events.map((evt) => (
                  <div
                    key={evt.id}
                    style={{
                      padding: '0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--card-subtle-bg)',
                    }}
                  >
                    <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{evt.name}</strong>
                    <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                      {evt.recipients?.requester && (
                        <span className="badge badge-subtle">Solicitante</span>
                      )}
                      {evt.recipients?.technician && (
                        <span className="badge badge-subtle" style={{ color: '#60a5fa' }}>Técnico</span>
                      )}
                      {evt.recipients?.admin && (
                        <span className="badge badge-subtle" style={{ color: '#f59e0b' }}>Admin</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Area: Template Editor & Tag Cheatsheet */}
          {selectedTemplate ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Tag Cheatsheet Card */}
              <div className="card" style={{ padding: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    ETIQUETAS DINÁMICAS DISPONIBLES (Haz clic para copiar):
                  </span>
                  {copiedTag && (
                    <span style={{ fontSize: '0.72rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <Check size={12} /> Copiado {copiedTag}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {[
                    '##ticket.number##',
                    '##ticket.title##',
                    '##ticket.priority##',
                    '##ticket.urgency##',
                    '##ticket.impact##',
                    '##author.name##',
                    '##technician.name##',
                    '##entity.name##',
                    '##followup.content##',
                    '##signature##',
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleCopyTag(tag)}
                      className="tag-pill-btn"
                      title="Copiar etiqueta"
                    >
                      <code>{tag}</code>
                      <Copy size={11} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Editor Form */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                      {selectedTemplate.name}
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      ID: {selectedTemplate.id}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setPreviewHtml(!previewHtml)}
                      className={`btn btn-sm ${previewHtml ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Eye size={13} />
                      <span>{previewHtml ? 'Ver Código' : 'Vista Previa'}</span>
                    </button>
                  </div>
                </div>

                {templateSuccess && (
                  <div className="alert-banner success" style={{ marginBottom: '1rem' }}>
                    <CheckCircle2 size={16} />
                    <span>{templateSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label className="form-label">Plantilla del Asunto (Subject)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={templateForm.subject_template}
                      onChange={(e) => setTemplateForm({ ...templateForm, subject_template: e.target.value })}
                      required
                    />
                  </div>

                  {!previewHtml ? (
                    <>
                      <div>
                        <label className="form-label">Contenido HTML</label>
                        <textarea
                          className="form-input"
                          rows={10}
                          value={templateForm.html_template}
                          onChange={(e) => setTemplateForm({ ...templateForm, html_template: e.target.value })}
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                          required
                        />
                      </div>

                      <div>
                        <label className="form-label">Contenido Texto Plano (Fallback)</label>
                        <textarea
                          className="form-input"
                          rows={4}
                          value={templateForm.text_template}
                          onChange={(e) => setTemplateForm({ ...templateForm, text_template: e.target.value })}
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                          required
                        />
                      </div>
                    </>
                  ) : (
                    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '1rem', backgroundColor: '#ffffff', color: '#111827' }}>
                      <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                        <strong>Asunto renderizado:</strong> {templateForm.subject_template.replace('##ticket.number##', 'INC-2026-0009').replace('##ticket.title##', 'Demostración de Plantilla')}
                      </div>
                      <div
                        dangerouslySetInnerHTML={{
                          __html: templateForm.html_template
                            .replace(/##ticket\.number##/g, 'INC-2026-0009')
                            .replace(/##ticket\.title##/g, 'Fallo en disco SSD')
                            .replace(/##ticket\.content##/g, 'El disco SSD no es reconocido por el sistema operativo.')
                            .replace(/##ticket\.priority##/g, 'Alta')
                            .replace(/##author\.name##/g, 'Carlos Gomez')
                            .replace(/##technician\.name##/g, 'Alex Dev')
                            .replace(/##entity\.name##/g, 'Root Entity')
                            .replace(/##followup\.content##/g, 'Se ha ordenado el reemplazo bajo garantía.')
                            .replace(/##signature##/g, 'Mesa de Ayuda ITILSuite'),
                        }}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button
                      type="submit"
                      disabled={savingTemplate}
                      className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <CheckCircle2 size={16} />
                      <span>{savingTemplate ? 'Guardando...' : 'Guardar Plantilla'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Selecciona una plantilla de la izquierda para editar</span>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: NOTIFICATION QUEUE (OUTBOX AUDIT) */}
      {/* ========================================================================= */}
      {activeTab === 'queue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Top Bar Actions & Filters */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Filter size={15} color="#9ca3af" />
                <select
                  className="form-input"
                  style={{ width: 'auto', fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}
                  value={queueStatusFilter}
                  onChange={(e) => setQueueStatusFilter(e.target.value)}
                >
                  <option value="">Todos los estados</option>
                  <option value="pending">Pendientes (Pending)</option>
                  <option value="sent">Enviados (Sent)</option>
                  <option value="failed">Fallidos (Failed)</option>
                </select>
              </div>

              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {queueItems.length} correos en cola
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={handleProcessQueueNow}
                disabled={processingQueue}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
              >
                <Send size={14} className={processingQueue ? 'spin' : ''} />
                <span>{processingQueue ? 'Enviando...' : 'Procesar Cola Ahora'}</span>
              </button>
            </div>
          </div>

          {queueMessage && (
            <div className="alert-banner success">
              <CheckCircle2 size={16} />
              <span>{queueMessage}</span>
            </div>
          )}

          {/* Queue Table */}
          <div className="tickets-table-container">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Destinatario</th>
                  <th>Asunto del Correo</th>
                  <th>Evento</th>
                  <th>Intentos</th>
                  <th>Fecha Encolado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {queueItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      No hay notificaciones en la cola de salida para el filtro seleccionado.
                    </td>
                  </tr>
                ) : (
                  queueItems.map((item) => (
                    <tr key={item.id} className="ticket-row" style={{ cursor: 'default' }}>
                      <td>
                        <span className={`status-pill queue-${item.status}`}>
                          {item.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--text-primary)', display: 'block', fontSize: '0.82rem' }}>
                          {item.recipient_email}
                        </strong>
                        {item.recipient_name && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {item.recipient_name}
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {item.subject}
                        </span>
                        {item.last_error && (
                          <div style={{ color: '#f87171', fontSize: '0.7rem', marginTop: '0.15rem' }}>
                            Error: {item.last_error}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-subtle">{item.event_key}</span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{item.attempts}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button
                            onClick={() => setViewingQueueItem(item)}
                            className="btn btn-secondary btn-sm"
                            title="Ver contenido del correo"
                          >
                            <Eye size={13} />
                          </button>
                          {item.status === 'failed' && (
                            <button
                              onClick={() => handleRetryQueueItem(item.id)}
                              className="btn btn-primary btn-sm"
                              title="Reintentar envío"
                            >
                              <RefreshCw size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Viewing Queue Item Modal */}
      {viewingQueueItem && (
        <div className="modal-backdrop" onClick={() => setViewingQueueItem(null)}>
          <div
            className="modal-card"
            style={{ maxWidth: '650px', width: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                Auditoría de Correo: {viewingQueueItem.subject}
              </h3>
              <button
                onClick={() => setViewingQueueItem(null)}
                className="btn-icon"
              >
                <XCircle size={18} />
              </button>
            </div>

            <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              <div><strong>Destinatario:</strong> {viewingQueueItem.recipient_email}</div>
              <div><strong>Evento:</strong> {viewingQueueItem.event_key}</div>
              <div><strong>Estado:</strong> {viewingQueueItem.status.toUpperCase()}</div>
              <div><strong>Fecha:</strong> {new Date(viewingQueueItem.created_at).toLocaleString()}</div>
            </div>

            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '1rem', backgroundColor: '#ffffff', color: '#111827', maxHeight: '350px', overflowY: 'auto' }}>
              <div dangerouslySetInnerHTML={{ __html: viewingQueueItem.body_html }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button onClick={() => setViewingQueueItem(null)} className="btn btn-secondary">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
