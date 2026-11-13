import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

function config() {
    const bucket = process.env.S3_BUCKET_NAME;
    const region = process.env.AWS_REGION;
    if (!bucket || !region) throw new Error('Configura AWS_REGION y S3_BUCKET_NAME para los adjuntos');
    return { bucket, client: new S3Client({ region }) };
}

function objectKey(location: string, bucket: string) {
    const prefix = `s3://${bucket}/`;
    if (!location.startsWith(prefix) || !location.slice(prefix.length).startsWith('attendance-system/justifications/')) {
        throw new Error('Ubicación del adjunto no válida para S3');
    }
    return location.slice(prefix.length);
}

export async function uploadJustification(file: File, userId: number, extension: string) {
    const { bucket, client } = config();
    const key = `attendance-system/justifications/${userId}/${crypto.randomUUID()}.${extension}`;
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: Buffer.from(await file.arrayBuffer()), ContentType: file.type }));
    return `s3://${bucket}/${key}`;
}

export async function deleteJustification(location: string) {
    const { bucket, client } = config();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey(location, bucket) }));
}

export async function readJustification(location: string) {
    const { bucket, client } = config();
    return client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey(location, bucket) }));
}
