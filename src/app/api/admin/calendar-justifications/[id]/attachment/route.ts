import { NextRequest, NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { verifyAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await verifyAuth(req);
        if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        const { id } = await params;
        if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
        const result = await db.query('SELECT attachment_url, attachment_name FROM attendance_justifications WHERE id = $1', [id]);
        const notification = result.rows[0];
        if (!notification?.attachment_url) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
        const blob = await get(notification.attachment_url, { access: 'private' });
        if (!blob || blob.statusCode !== 200) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
        return new Response(blob.stream, { headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(notification.attachment_name || 'archivo')}`,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
        } });
    } catch (error) {
        console.error('Error al descargar adjunto:', error);
        return NextResponse.json({ error: 'No se pudo descargar el archivo' }, { status: 500 });
    }
}
