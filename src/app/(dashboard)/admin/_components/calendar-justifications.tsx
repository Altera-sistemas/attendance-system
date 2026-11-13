'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface Entry { id: number; message: string | null; attachment_name: string | null; created_at: string; admin_name: string }

export function CalendarJustifications({ userId, date, onSaved }: { userId?: string; date: string; onSaved?: () => void }) {
    const [entries, setEntries] = useState<Entry[]>([]);
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState('');

    useEffect(() => {
        let active = true;
        if (!userId) return;
        fetch(`/api/admin/calendar-justifications?userId=${userId}&date=${date}`)
            .then(async response => {
                if (!response.ok) throw new Error('No se pudo cargar el registro');
                const data = await response.json();
                if (active) setEntries(data.entries);
            })
            .catch(error => { if (active) setFeedback(error.message); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [userId, date]);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!userId) return;
        const form = event.currentTarget;
        const data = new FormData(form);
        data.set('userId', userId);
        data.set('date', date);
        setSending(true);
        setFeedback('');
        try {
            const response = await fetch('/api/admin/calendar-justifications', { method: 'POST', body: data });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'No se pudo guardar');
            setEntries(previous => [result.entry, ...previous]);
            onSaved?.();
            form.reset();
            setFeedback('Registro guardado. Solo visible para administradores.');
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : 'No se pudo guardar');
        } finally { setSending(false); }
    }

    if (!userId) return <p className="py-4 text-sm text-slate-500">Selecciona un trabajador en el calendario para consultar sus justificaciones.</p>;

    return <div className="space-y-4 py-3">
        <p className="text-sm text-slate-500">Registro interno de justificaciones de este día. Solo los administradores pueden verlo.</p>
        <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="justification-message">Observación (opcional)</Label>
                <Textarea id="justification-message" name="message" maxLength={2000} placeholder="Por ejemplo: No justificado" disabled={sending} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="justification-file">Documento de justificación (opcional)</Label>
                <Input id="justification-file" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={sending} />
                <p className="text-xs text-slate-500">PDF o imagen. Máximo 4 MB.</p>
            </div>
            <Button disabled={sending || loading} type="submit">{sending ? 'Guardando…' : 'Guardar registro'}</Button>
        </form>
        {feedback && <p role="status" className="text-sm">{feedback}</p>}
        <div className="space-y-3 border-t pt-3">
            <h4 className="font-medium">Registros del día</h4>
            {loading ? <p>Cargando…</p> : entries.length === 0 ? <p className="text-sm text-slate-500">Sin justificaciones registradas.</p> : entries.map(entry => <div key={entry.id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-xs text-slate-500">{entry.admin_name} · {new Date(entry.created_at).toLocaleString('es-PE', { timeZone: 'America/Lima' })}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{entry.message || (entry.attachment_name ? 'Documento de justificación adjunto' : 'Sin observación ni archivo')}</p>
                {entry.attachment_name && <div className="mt-2 flex flex-wrap gap-3 text-sm text-blue-600">
                    <a className="underline" href={`/api/admin/calendar-justifications/${entry.id}/attachment?preview=1`} target="_blank" rel="noopener noreferrer">Ver archivo</a>
                    <a className="underline" href={`/api/admin/calendar-justifications/${entry.id}/attachment`}>Descargar {entry.attachment_name}</a>
                </div>}
            </div>)}
        </div>
    </div>;
}
