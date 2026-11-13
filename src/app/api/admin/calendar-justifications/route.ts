import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { verifyAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
    let uploadedUrl: string | undefined;
    try {
        const auth = await verifyAuth(req);
        if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        const data = await req.formData();
        const userId = Number(data.get('userId'));
        const date = String(data.get('date') || '');
        const message = String(data.get('message') || '').trim();
        if (!Number.isSafeInteger(userId) || userId <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || message.length > 2000) {
            return NextResponse.json({ error: 'Usuario, fecha o mensaje inválido' }, { status: 400 });
        }
        const target = await db.query('SELECT id FROM users WHERE id = $1 AND is_active = true', [userId]);
        if (!target.rows.length) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        const file = data.get('file');
        let filename: string | null = null;
        if (file instanceof File && file.size > 0) {
            const extensions: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
            const extension = extensions[file.type];
            if (!extension || file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'Usa PDF o imagen de hasta 4 MB' }, { status: 400 });
            const blob = await put(`justifications/${userId}/${crypto.randomUUID()}.${extension}`, file, { access: 'private', contentType: file.type });
            uploadedUrl = blob.url;
            filename = file.name.slice(0, 255);
        }
        const result = await db.query(
            `INSERT INTO attendance_justifications (user_id, attendance_date, message, attachment_url, attachment_name, created_by)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [userId, date, message || null, uploadedUrl || null, filename, auth.userId]
        );
        const saved = await db.query(`SELECT j.id, j.message, j.attachment_name, j.created_at, u.name AS admin_name
            FROM attendance_justifications j JOIN users u ON u.id = j.created_by WHERE j.id = $1`, [result.rows[0].id]);
        uploadedUrl = undefined;
        return NextResponse.json({ entry: saved.rows[0] }, { status: 201 });
    } catch (error) {
        if (uploadedUrl) await del(uploadedUrl).catch(() => {});
        console.error('Error al enviar notificación del calendario:', error);
        return NextResponse.json({ error: 'No se pudo enviar la notificación' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        const userId = Number(req.nextUrl.searchParams.get('userId'));
        const date = req.nextUrl.searchParams.get('date') || '';
        if (!Number.isSafeInteger(userId) || userId <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
            return NextResponse.json({ error: 'Usuario o fecha inválidos' }, { status: 400 });
        }
        const result = await db.query(`SELECT j.id, j.message, j.attachment_name, j.created_at, u.name AS admin_name
            FROM attendance_justifications j JOIN users u ON u.id = j.created_by
            WHERE j.user_id = $1 AND j.attendance_date = $2 ORDER BY j.created_at DESC, j.id DESC`, [userId, date]);
        return NextResponse.json({ entries: result.rows });
    } catch (error) {
        console.error('Error al consultar justificaciones:', error);
        return NextResponse.json({ error: 'No se pudieron cargar las justificaciones' }, { status: 500 });
    }
}
