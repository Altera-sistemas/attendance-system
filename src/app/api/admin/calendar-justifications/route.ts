import { NextRequest, NextResponse } from 'next/server';
import { uploadJustification, deleteJustification } from '@/lib/justification-storage';
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
            uploadedUrl = await uploadJustification(file, userId, extension);
            filename = file.name.slice(0, 255);
        }
        const result = await db.query(
            `INSERT INTO attendance_justifications (user_id, attendance_date, message, attachment_url, attachment_name, created_by)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [userId, date, message || null, uploadedUrl || null, filename, auth.userId]
        );
        // El archivo ya pertenece al registro guardado; no borrarlo si falla la consulta siguiente.
        uploadedUrl = undefined;
        const saved = await db.query(`SELECT j.id, j.message, j.attachment_name, j.created_at, u.name AS admin_name
            FROM attendance_justifications j JOIN users u ON u.id = j.created_by WHERE j.id = $1`, [result.rows[0].id]);
        uploadedUrl = undefined;
        return NextResponse.json({ entry: saved.rows[0] }, { status: 201 });
    } catch (error) {
        if (uploadedUrl) await deleteJustification(uploadedUrl).catch(() => {});
        console.error('Error al guardar justificación del calendario:', error);
        return NextResponse.json({ error: 'No se pudo guardar la justificación. Verifica la configuración y los permisos de S3 si adjuntaste un archivo.' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth || auth.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        const userId = Number(req.nextUrl.searchParams.get('userId'));
        const startDate = req.nextUrl.searchParams.get('startDate');
        const endDate = req.nextUrl.searchParams.get('endDate');
        if (startDate || endDate) {
            const validDate = (value: string | null): value is string => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
            const allUsers = req.nextUrl.searchParams.get('userId') === 'all';
            if (!validDate(startDate) || !validDate(endDate) || startDate > endDate || (Date.parse(endDate) - Date.parse(startDate)) / 86400000 > 62 || (!allUsers && (!Number.isSafeInteger(userId) || userId <= 0))) {
                return NextResponse.json({ error: 'Rango o usuario inválido' }, { status: 400 });
            }
            const result = await db.query(`SELECT j.id, j.user_id, to_char(j.attendance_date, 'YYYY-MM-DD') AS date,
                j.message, j.attachment_name, u.name AS user_name
                FROM attendance_justifications j JOIN users u ON u.id = j.user_id
                WHERE j.attendance_date BETWEEN $1 AND $2 ${allUsers ? '' : 'AND j.user_id = $3'}
                ORDER BY j.created_at DESC, j.id DESC`, allUsers ? [startDate, endDate] : [startDate, endDate, userId]);
            return NextResponse.json({ entries: result.rows });
        }
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
