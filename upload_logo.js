require('dotenv').config();
const AWS = require('aws-sdk');
const fs = require('fs');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const fileContent = fs.readFileSync('D:\\server-vaidik\\web-vaidik-main\\public\\Vaidik-talk1.png');

const params = {
  Bucket: process.env.AWS_S3_BUCKET_NAME,
  Key: 'assets/Vaidik-talk1-full.png',
  Body: fileContent,
  ContentType: 'image/png'
};

s3.upload(params, function(err, data) {
  if (err) {
    console.log("Error", err);
  } else {
    console.log("Upload Success", data.Location);
  }
});
