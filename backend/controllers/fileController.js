const aws = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");

const s3 = new aws.S3({
    accessKey: process.env.DAWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.DAWS_SECRET_ACCESS_KEY,
    region: process.env.S3DIRECT_REGION
});

exports.uploadToS3 = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.DAWS_STORAGE_BUCKET_NAME,
        contentType: multerS3.AUTO_CONTENT_TYPE,
        acl: "public-read",
        metadata: function(req, file, cb) {
            cb(null, { fieldName: file.fieldname });
        },
        key: function(req, file, cb) {
            cb(null, `${Date.now().toString()}-${file.originalname}`);
        }
    })
});

exports.uploadFile = async (req, res, next) => {
    res.json(req.file);
};
