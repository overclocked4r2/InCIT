import { useState, useEffect } from 'react';
import { api } from '../api';
import type { AuditLogEntry, ValidationReport } from '../types';
import { Card, Button, Badge, Spinner, EmptyState } from '../components/ui';

export function AuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [filterEntity, setFilterEntity] = useState('all');

  const load = () => {
    setLoading(true);
    api.audit(200)
      .then(setLogs)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  /* Validate */
  const runValidation = async () => {
    setValidating(true);
    setError('');
    try {
      const r = await api.validate();
      setValidation(r);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setValidating(false);
    }
  };

  /* Export */
  const exportSchedule = async (filename: string) => {
    setExporting(true);
    setError('');
    try {
      const res = await api.saveExport(filename);
      setSuccessMsg(`Saved to ${res.path}`);
      await load(); // refresh audit
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  /* Reset */
  const resetAll = async () => {
    if (!confirm('Reset all state? This clears timetable, bookings, and audit log.')) return;
    try {
      await api.reset();
      setSuccessMsg('All state reset');
      setLogs([]);
      setValidation(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  };

  const entityTypes = ['all', ...new Set(logs.map(l => l.entity_type))];
  const filtered = filterEntity === 'all' ? logs : logs.filter(l => l.entity_type === filterEntity);

  const actionColor = (a: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
    if (a.includes('error') || a.includes('rejected')) return 'danger';
    if (a.includes('published') || a.includes('approved') || a.includes('scheduled')) return 'success';
    if (a.includes('applied') || a.includes('created') || a.includes('processed')) return 'info';
    if (a.includes('cleared') || a.includes('archived')) return 'warning';
    return 'default';
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Controls */}
      <div className="glass p-5 flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex-1">
          <h2 className="text-lg font-bold tracking-tight">Audit Trail & Controls</h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Full chronological history of solver runs, bookings, publications, and validations
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={runValidation} loading={validating} variant="secondary">
            ✓ Validate
          </Button>
          <Button onClick={() => exportSchedule('schedule.json')} loading={exporting} variant="secondary">
            📤 Export schedule.json
          </Button>
          <Button onClick={() => exportSchedule('schedule_after.json')} loading={exporting} variant="secondary">
            📤 Export schedule_after.json
          </Button>
          <Button onClick={resetAll} variant="danger">
            Reset All
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-[var(--color-danger)]!">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </Card>
      )}
      {successMsg && (
        <Card className="border-[var(--color-success)]!">
          <p className="text-sm text-[var(--color-success)]">✓ {successMsg}</p>
        </Card>
      )}

      {/* Validation Report */}
      {validation && (
        <Card>
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
            <span className={validation.hard_violation_count === 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>
              {validation.hard_violation_count === 0 ? '✓' : '✕'}
            </span>
            Validation Report
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="text-center p-3 rounded-lg bg-[var(--color-surface-2)]">
              <div className={`text-xl font-bold ${validation.hard_violation_count === 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                {validation.hard_violation_count}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">Hard Violations</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-[var(--color-surface-2)]">
              <div className="text-xl font-bold text-[var(--color-warning)]">{validation.soft_total}</div>
              <div className="text-xs text-[var(--color-text-muted)]">Soft Penalty</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-[var(--color-surface-2)]">
              <div className="text-xl font-bold text-[var(--color-info)]">{validation.warnings.length}</div>
              <div className="text-xs text-[var(--color-text-muted)]">Warnings</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-[var(--color-surface-2)]">
              <div className="text-xl font-bold text-[var(--color-text-secondary)]">
                {Object.keys(validation.hard_by_rule).length}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">Rules Checked</div>
            </div>
          </div>

          {/* Hard violations by rule */}
          {Object.keys(validation.hard_by_rule).length > 0 && (
            <div className="space-y-1 mb-3">
              <div className="text-xs font-medium text-[var(--color-text-muted)]">Hard violations by rule:</div>
              {Object.entries(validation.hard_by_rule).map(([rule, count]) => (
                <div key={rule} className="flex items-center justify-between text-xs p-2 rounded-md bg-[var(--color-surface-2)]">
                  <span className="text-[var(--color-text-secondary)]">{rule}</span>
                  <Badge variant={count === 0 ? 'success' : 'danger'}>{count}</Badge>
                </div>
              ))}
            </div>
          )}

          {/* Soft penalties */}
          {Object.keys(validation.soft_penalties).length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-[var(--color-text-muted)]">Soft penalties:</div>
              {Object.entries(validation.soft_penalties).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between text-xs p-2 rounded-md bg-[var(--color-surface-2)]">
                  <span className="text-[var(--color-text-secondary)]">{key}</span>
                  <span className="font-mono text-[var(--color-warning)]">{val}</span>
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {validation.warnings.length > 0 && (
            <div className="mt-3 space-y-1">
              <div className="text-xs font-medium text-[var(--color-text-muted)]">Warnings:</div>
              {validation.warnings.map((w, i) => (
                <div key={i} className="text-xs p-2 rounded-md bg-[var(--color-warning-dim)] text-[var(--color-warning)]">{w}</div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Entity filter */}
      <div className="flex flex-wrap gap-1">
        {entityTypes.map(et => (
          <button
            key={et}
            onClick={() => setFilterEntity(et)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              filterEntity === et
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {et}
          </button>
        ))}
      </div>

      {/* Audit log */}
      {loading ? (
        <div className="flex items-center justify-center h-48"><Spinner size={28} /></div>
      ) : logs.length === 0 ? (
        <EmptyState icon="◷" title="No audit events" sub="Events will appear here as you interact with the system" />
      ) : (
        <div className="space-y-1.5">
          {filtered.map(log => (
            <div
              key={log.id}
              className="glass !p-3 flex items-start gap-3 hover:border-[var(--color-accent)]!/30 transition-colors"
            >
              {/* Timeline dot */}
              <div className="mt-1.5 w-2 h-2 rounded-full bg-[var(--color-accent)] shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant={actionColor(log.action)}>{log.action}</Badge>
                  <span className="text-xs text-[var(--color-text-muted)]">{log.entity_type}/{log.entity_id}</span>
                </div>
                {Object.keys(log.details).length > 0 && (
                  <div className="text-xs text-[var(--color-text-muted)] font-mono bg-[var(--color-surface-2)] rounded-md p-2 mt-1 overflow-x-auto">
                    {JSON.stringify(log.details, null, 2)}
                  </div>
                )}
              </div>

              <span className="text-[10px] text-[var(--color-text-muted)] shrink-0 mt-0.5">
                {new Date(log.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
