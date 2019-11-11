# s3uploader

```javascript
const uploader = require("s3uploader");

uploader({
    cwd: "./dist",
    // AWS Configuration
    accessKeyId: "<Your accessKeyId>",
    secretAccessKey: "<Your secretAccessKey>",
    region: "<Your region>",
    // AWS Upload Settings
    Bucket: "<Target Bucket Name>",
    CacheControl: "max-age=72000",
    ACL: "private",
    // options
    compress: true,
    logging: true,
    transformKey(Key) {
        return "example/" + Key;
    },
    filterAtKey(Key) {
        return Key.startsWith("example/");
    }
})
```