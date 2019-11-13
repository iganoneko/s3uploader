var path = require('path');
var fs = require('fs');
var zlib = require('zlib');
var minimatch = require('minimatch');
var glob = require('glob');
var asyncJs = require('async');
var mime = require('mime-types');
var AWS = require('aws-sdk');

/**
 * @Author iganoneko@gmail.com
 * 
 * ------------------------------------------------------------------------------------------------
 * File Search
 * ------------------------------------------------------------------------------------------------
 * config.cwd             : string          = Current Directory
 * config.includes        : Array<string>   = Specify the file patterns to include in the upload
 * config.excludes        : Array<string>   = Specify file patterns to exclude from upload
 *
 * ------------------------------------------------------------------------------------------------
 * Upload Settings
 * ------------------------------------------------------------------------------------------------
 *
 * config.compress        : boolean         = Compress with GZIP and upload
 * config.concurrency     : number          = Upload concurrency. Default = 5
 *
 * ------------------------------------------------------------------------------------------------
 * AWS Settings
 * ------------------------------------------------------------------------------------------------
 *
 * config.credentials     : object          = new AWS.SharedIniFileCredentials({ profile: 'default' })
 * config.accessKeyId     : string          = S3 accessKeyId
 * config.secretAccessKey : string          = S3 secretAccessKey
 * config.region          : string          = S3 region. Default: 'ap-northeast-1'
 * config.Bucket          : string          = S3 Bucket Name
 * config.ACL             : string          = ACL
 * config.CacheControl    : string          = Cache-Control. Default: 'max-age=60'
 *
 * ------------------------------------------------------------------------------------------------
 * Safety & Verify
 * ------------------------------------------------------------------------------------------------
 *
 * config.test            : boolean         = Display the list of uploaded keys without actually uploading them
 * config.logging         : boolean         = Log upload status
 * config.transformKey    : function(key:string):string
 * config.filterAtKey     : function(key:string):boolean
 */

module.exports = function (config, done) {
    var log;
    if (config.logging) {
        log = function () {
            console.log.apply(console, Array.prototype.slice.call(arguments));
        };
    } else {
        log = function () { };
    }

    var defaultValues = {
        logging: true,
        concurrency: 5,
        CacheControl: 'max-age=300',
        ACL: 'public-read',
        compress: false,
        test: false,
        includes: '**/**',
        excludes: null,
        region: 'ap-northeast-1',
    };

    var hasCWDParam = config.hasOwnProperty('cwd');
    var hasBucketParam = config.hasOwnProperty('Bucket');
    var hasCredentialsParam = config.hasOwnProperty('credentials');
    var hasAccessKeyIdParam = config.hasOwnProperty('accessKeyId');
    var hasSecretAccessKeyParam = config.hasOwnProperty('secretAccessKey');

    if (!hasCWDParam) {
        throw new Error('"cwd" Is a required parameter');
    }
    if (!hasBucketParam) {
        throw new Error('"Bucket" Is a required parameter');
    }
    if (!hasCredentialsParam) {
        if (!hasAccessKeyIdParam || !hasSecretAccessKeyParam) {
            throw new Error('"credentials" or "accessKeyId" / "secretAccessKey" Is a required parameter');
        }
    }

    Object.keys(defaultValues).forEach(function (key) {
        config[key] = config[key] || defaultValues[key];
    });

    log("Bucket:", config.Bucket);

    if (hasAccessKeyIdParam && hasSecretAccessKeyParam) {
        AWS.config.update({
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            region: config.region
        });
    } else if (hasCredentialsParam) {
        AWS.config.update({
            credentials: config.credentials
        });
    }

    var s3 = new AWS.S3({ signatureVersion: 'v4' });

    var putObject = function (file, callback) {

        if (isIgnoreFilename(path.basename(file))) {
            callback(null);
            return;
        }

        readFile(path.join(config.cwd, file), function (error, result) {
            if (error) {
                callback(error);
                return;
            }

            if (isExclude(file)) {
                callback(null);
                return;
            }

            var putOptions = newS3PutOptions(file);
            if (putOptions === null) {
                return;
            }

            if (typeof config.transformKey === "function") {
                putOptions.Key = config.transformKey(putOptions.Key);
            }

            if (typeof config.filterAtKey === 'function') {
                if (!config.filterAtKey(putOptions.Key)) {
                    callback(null);
                    return;
                }
            }

            log('Upload ' + (config.test ? '(test)' : '') + ':', putOptions.Key);
            if (config.test) {
                callback(null);
                return;
            }

            putOptions.Body = result;
            s3.putObject(putOptions, function (error) {
                if (error) {
                    callback(error);
                    return;
                }
                callback(null);
            });
        });
    };

    var newS3PutOptions = function (key) {
        var contentType;
        var extname = path.extname(key);
        try {
            contentType = mime.contentType(extname);
        } catch (e) {
            return null;
        }

        var putOptions = {
            Bucket: config.Bucket,
            ACL: config.ACL,
            Key: key,
            CacheControl: config.CacheControl,
            ContentType: contentType
        };

        if (config.compress && !isPlainFile(extname)) {
            putOptions.ContentEncoding = 'gzip';
            putOptions.Metadata = {
                'Vary': 'Accept-Encoding'
            };
        }

        return putOptions;
    };

    var listFiles = function () {
        var includes = config.includes;
        var results = [];
        if (!Array.isArray(includes)) {
            includes = [includes];
        }
        includes.forEach(function (pattern) {
            results = results.concat(glob.sync(pattern, {
                cwd: config.cwd
            }));
        });
        return results.filter(function (file) {
            var stat = fs.statSync(path.join(config.cwd, file));
            return !stat.isDirectory();
        });
    };

    var isExclude = function (file) {
        if (!config.excludes || !file) {
            return false;
        }
        var length = config.excludes.length;
        while (length--) {
            if (minimatch(file, config.excludes[length], {
                matchBase: true
            })) {
                return true;
            }
        }
        return false;
    };

    var isPlainFile = function (extname) {
        return [
            '.png', '.jpg', '.gif',
            '.ico',
            '.mp3', '.mp4', '.ogg'
        ].indexOf(extname) !== -1;
    };

    var isIgnoreFilename = function (filename) {
        return [
            '.DS_Store',
            'Thumbs.db',
            'bower_components',
            'node_modules'
        ].indexOf(filename) !== -1;
    };

    var readFile = function (file, callback) {
        fs.readFile(file, function (err, data) {
            if (err) {
                callback(err, null);
                return;
            }
            if (config.compress && !isPlainFile(path.extname(file))) {
                zlib.gzip(data, function (err, compressedData) {
                    if (err) {
                        callback(err, null);
                        return;
                    }
                    callback(null, compressedData);
                });
            }
            else {
                callback(null, data);
            }
        });
    };

    var q = asyncJs.queue(putObject, config.concurrency);
    q.drain(done);
    q.push(listFiles(), function (error) {
        if (error) {
            log(error);
        }
    });
};
