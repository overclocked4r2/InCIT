import { useState } from 'react';
import { api } from '../api';
import type { NLBookResponse, NLBookingSubmission } from '../types';
import { Card, Button, Badge, EmptyState } from '../components/ui';
import { ManualFormsPage } from './ManualForms';

const EXAMPLES = [
  'Book a seminar hall for 80 students on Wednesday, periods 3-4, need projector',
  'I need a lab with 40 seats for Thursday morning, accessible room please',
  'मुझे बुधवार को 60 छात्रों के लिए एक क्लासरूम चाहिए, पीरियड 5-6',
  'Kal shaam ko seminar hall chahiye, 200 log, 2 ghante',
  'Budhvaar shaam 6 se 8 baje auditorium chahiye, 80 log',
  'Reserve lecture hall for 120 students, any day afternoon, needs projector and mic',
  'Small room for 20 people, Friday period 1, tutorial session',
];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  booking?: NLBookResponse['booking'];
  parsed?: NLBookResponse['parsed'];
  status?: string;
  mode?: NLBookResponse['mode'];
  draft?: NLBookingSubmission;
}

export function NLBookingPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const submit = async (text?: string) => {
    const t = text ?? input.trim();
    if (!t) return;
    setInput('');

    const userMsg: ChatMessage = { role: 'user', content: t };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await api.nlBook(t);

      let content = '';
      if (res.status === 'assistant') {
        content = res.message ?? 'How can I help with your room booking?';
      } else if (res.status === 'draft_ready') {
        content = `Suggested slot: ${res.booking?.room_name} (${res.booking?.room_id}), ${res.booking?.day} P${res.booking?.start_period}–P${res.booking?.end_period}. ${res.message ?? 'Review and edit the details below, then submit to reserve.'}`;
      } else if (res.status === 'approved') {
        content = `✓ Booking approved!\nRoom: ${res.booking?.room_name} (${res.booking?.room_id})\nDay: ${res.booking?.day}, Periods ${res.booking?.start_period}–${res.booking?.end_period}\nCapacity: ${res.booking?.room_capacity}`;
      } else if (res.status === 'alternative_offered') {
        content = `↻ Alternative offered:\nRoom: ${res.booking?.room_name} (${res.booking?.room_id})\nDay: ${res.booking?.day}, Periods ${res.booking?.start_period}–${res.booking?.end_period}`;
      } else if (res.status === 'needs_clarification') {
        content = `❓ Need more details:\n${res.follow_up}`;
      } else if (res.status === 'no_timetable') {
        content = `⚠ ${res.message ?? 'No timetable available. Generate one first.'}`;
      } else {
        content = `✕ ${res.message ?? 'No suitable venue found for the request.'}`;
      }

      if (res.accessibility_warning) {
        content += `\n\n♿ ${res.accessibility_warning}`;
      }

      const botMsg: ChatMessage = {
        role: 'assistant',
        content,
        booking: res.booking,
        parsed: res.parsed,
        status: res.status,
        mode: res.mode,
        draft: res.status === 'draft_ready' && res.booking ? {
          room_id: res.booking.room_id,
          day: res.booking.day,
          start_period: res.booking.start_period,
          duration_periods: res.booking.end_period - res.booking.start_period + 1,
          attendance: res.parsed?.attendance ?? 1,
          purpose: res.parsed?.title ?? 'Room booking',
          needs: res.parsed?.needs ?? [],
          mandatory_for_groups: res.parsed?.mandatory_for_groups ?? [],
        } : undefined,
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (e: unknown) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `I couldn’t process that yet: ${(e as Error).message}`,
        status: 'error',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const updateDraft = (messageIndex: number, key: keyof NLBookingSubmission, value: string | number | string[]) => {
    setMessages(previous => previous.map((message, index) => {
      if (index !== messageIndex || !message.draft) return message;
      return { ...message, draft: { ...message.draft, [key]: value } };
    }));
  };

  const confirmDraft = async (messageIndex: number) => {
    const draft = messages[messageIndex]?.draft;
    if (!draft) return;
    setLoading(true);
    try {
      const result = await api.submitNlBooking(draft);
      setMessages(previous => previous.map((message, index) => index !== messageIndex ? message : {
        ...message,
        status: result.status,
        content: result.status === 'approved'
          ? `✓ Booking reserved. ${result.booking?.room_name ?? draft.room_id} (${result.booking?.room_id ?? draft.room_id}), ${draft.day} P${draft.start_period}–P${draft.start_period + draft.duration_periods - 1}.`
          : result.message,
        booking: result.booking ?? message.booking,
        draft: result.status === 'approved' ? undefined : message.draft,
      }));
    } catch (error) {
      setMessages(previous => previous.map((message, index) => index !== messageIndex ? message : {
        ...message, status: 'error', content: (error as Error).message,
      }));
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (s?: string) => {
    if (!s) return null;
    const map: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
      approved: 'success',
      alternative_offered: 'warning',
      needs_clarification: 'info',
      draft_ready: 'info',
      assistant: 'info',
      rejected: 'danger',
      no_timetable: 'warning',
      error: 'danger',
    };
    return <Badge variant={map[s] ?? 'default'}>{s.replace('_', ' ')}</Badge>;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-up">
      {/* Header */}
      <Card>
        <h2 className="text-lg font-bold tracking-tight">Natural Language Booking</h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          English, Hindi, or Hinglish mein apni room request likhein. We’ll turn it into an editable draft; availability and booking rules are checked by the system.
        </p>
      </Card>

      {/* Examples */}
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex, i) => (
          <button
            key={i}
            onClick={() => submit(ex)}
            className="text-xs px-3 py-1.5 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-all duration-150 text-left"
          >
            {ex.length > 60 ? ex.slice(0, 57) + '…' : ex}
          </button>
        ))}
      </div>

      {/* Chat area */}
      <div className="glass min-h-[300px] max-h-[500px] overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <EmptyState
            icon="✎"
            title="Start a conversation"
            sub="English, Hindi, ya Hinglish mein request likhein, ya upar example chunein"
          />
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-br-sm'
                    : 'bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-bl-sm'
                }`}
              >
                {msg.role === 'assistant' && msg.status && (
                  <div className="mb-2 flex items-center gap-2">
                    {statusBadge(msg.status)}
                    {msg.mode && <Badge variant={msg.mode === 'ai' ? 'info' : 'default'}>{msg.mode === 'ai' ? 'AI mode' : 'Basic mode'}</Badge>}
                  </div>
                )}
                <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>
                {msg.parsed && (
                  <div className="mt-3 pt-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)] space-y-1">
                    <div className="font-medium text-[var(--color-text-secondary)]">Parsed Details:</div>
                    {msg.parsed.attendance && <div>Attendance: {msg.parsed.attendance}</div>}
                    {msg.parsed.duration_periods && <div>Duration: {msg.parsed.duration_periods} periods</div>}
                    {msg.parsed.room_types?.length > 0 && <div>Room types: {msg.parsed.room_types.join(', ')}</div>}
                    {msg.parsed.needs?.length > 0 && <div>Needs: {msg.parsed.needs.join(', ')}</div>}
                    {msg.parsed.confidence > 0 && <div>Confidence: {Math.round(msg.parsed.confidence * 100)}%</div>}
                  </div>
                )}
                {msg.draft && (
                  <form className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-3 text-xs" onSubmit={event => { event.preventDefault(); void confirmDraft(i); }}>
                    <label className="min-w-0">Room ID
                      <input required value={msg.draft.room_id} onChange={event => updateDraft(i, 'room_id', event.target.value.toUpperCase())} className="form-input mt-1 w-full" aria-label="Booking room ID" />
                    </label>
                    <label>Day
                      <select value={msg.draft.day} onChange={event => updateDraft(i, 'day', event.target.value)} className="form-input mt-1 w-full">
                        {['MON', 'TUE', 'WED', 'THU', 'FRI'].map(day => <option key={day}>{day}</option>)}
                      </select>
                    </label>
                    <label>Start period
                      <input required type="number" min="1" max="13" value={msg.draft.start_period} onChange={event => updateDraft(i, 'start_period', Number(event.target.value))} className="form-input mt-1 w-full" />
                    </label>
                    <label>Duration
                      <input required type="number" min="1" max="13" value={msg.draft.duration_periods} onChange={event => updateDraft(i, 'duration_periods', Number(event.target.value))} className="form-input mt-1 w-full" />
                    </label>
                    <label>Attendance
                      <input required type="number" min="1" value={msg.draft.attendance} onChange={event => updateDraft(i, 'attendance', Number(event.target.value))} className="form-input mt-1 w-full" />
                    </label>
                    <label>Purpose
                      <input required value={msg.draft.purpose} onChange={event => updateDraft(i, 'purpose', event.target.value)} className="form-input mt-1 w-full" />
                    </label>
                    <label className="col-span-2">Needs (comma separated)
                      <input value={msg.draft.needs.join(', ')} onChange={event => updateDraft(i, 'needs', event.target.value.split(',').map(item => item.trim()).filter(Boolean))} className="form-input mt-1 w-full" />
                    </label>
                    <label className="col-span-2">Groups that must be free (comma separated)
                      <input value={msg.draft.mandatory_for_groups.join(', ')} onChange={event => updateDraft(i, 'mandatory_for_groups', event.target.value.split(',').map(item => item.trim()).filter(Boolean))} className="form-input mt-1 w-full" placeholder="Y1-A, CSE-2" />
                    </label>
                    <Button disabled={loading} loading={loading} className="col-span-2">Confirm and reserve</Button>
                  </form>
                )}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-3 rounded-bl-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-pulse-dot" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-pulse-dot" style={{ animationDelay: '200ms' }} />
                <span className="w-2 h-2 rounded-full bg-[var(--color-text-muted)] animate-pulse-dot" style={{ animationDelay: '400ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && submit()}
          placeholder="Example: Kal shaam 6 baje seminar hall chahiye, 80 log…"
          className="flex-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all"
        />
        <Button onClick={() => submit()} disabled={!input.trim() || loading} loading={loading}>
          Send
        </Button>
      </div>

      <ManualFormsPage />
    </div>
  );
}
