require('dotenv').config();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');

const s3 = new S3Client({
  region: process.env.AWS_REGION.trim(),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim()
  }
});

const fileContent = fs.readFileSync('D:\\server-vaidik\\web-vaidik-main\\public\\Vaidik-talk1.png');

const params = {
  Bucket: process.env.AWS_S3_BUCKET.trim(),
  Key: 'assets/Vaidik-talk1-full.png',
  Body: fileContent,
  ContentType: 'image/png'
};

s3.send(new PutObjectCommand(params))
  .then(data => console.log("Upload Success: https://" + process.env.AWS_S3_BUCKET.trim() + ".s3." + process.env.AWS_REGION.trim() + ".amazonaws.com/assets/Vaidik-talk1-full.png"))
  .catch(err => console.log(err));
