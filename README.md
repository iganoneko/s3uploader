# @iganoneko/s3uploader

## When using the Callback function

```javascript
const uploader = require("@iganoneko/s3uploader");

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

## When using Promise

```javascript
const uploader = require("@iganoneko/s3uploader/promise");
uploader({ ...options }).then(function () {
    console.info('success');
}).catch(function (e) {
    console.error(e);
});
```
