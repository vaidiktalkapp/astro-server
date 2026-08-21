const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const s3Client = new S3Client({
    region: process.env.AWS_REGION.trim(),
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
    }
});

async function run() {
    const fileContent = fs.readFileSync('../web-vaidik-main/public/vaidiktalklogo.png');
    const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET.trim(),
        Key: 'assets/vaidiktalklogo.png',
        Body: fileContent,
        ContentType: 'image/png'
    });
    await s3Client.send(command);
    console.log('UPLOADED: https://' + process.env.AWS_S3_BUCKET.trim() + '.s3.' + process.env.AWS_REGION.trim() + '.amazonaws.com/assets/vaidiktalklogo.png');
}
run().catch(console.error);
