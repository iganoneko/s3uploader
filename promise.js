var uploader = require("./uploader");

module.exports = function (config) {
    return new Promise(function (resolve, reject) {
        uploader(config, function (error) {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
};