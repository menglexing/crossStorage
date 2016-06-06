﻿/**
 * 跨域存储
 * window.huya_crossStorage
 */
(function(window, $){
    if (window.huya_crossStorage) return;

    var crossStorage = window.huya_crossStorage = {
        setItem: function (key, val) {},
        getItem: function (key) {},
        removeItem: function (key) {},
        clear: function () {},
        change: function (callback) {}    // 模拟 window.onstorage 事件
    }

    var isPostMessageSupported = 'postMessage' in window;
    var isStorageSupported = 'localStorage' in window;

    // 不支持 postMessage 不能实现跨域存储，那么就降级为存在当前页面
    if (!isPostMessageSupported) {
        if (isStorageSupported) {
            crossStorage = window.huya_crossStorage = localStorage
        }

        return
    }

    // 代理仓库(本地数据库)
    var proxyReady = (function(){
        var proxy = null
        var defer = $.Deferred()

        return function (callback) {
            if (!proxy) {
                proxy = document.createElement('iframe');
                proxy.style.display = 'none';

                // 先插入再赋值src，否则IE6下onload事件将不会触发
                document.body.insertBefore(proxy, document.body.firstChild);

                $(proxy).on('load', function(){
                    defer.resolve(proxy.contentWindow)
                });

                proxy.src = 'http://hd.huya.com/proxy/storage.html';
            }

            defer.done(callback)
        }
    })();

    /*
     * 通信
     */
    var sendSuccessCallbacks = {}
    var storeChangeCallbacks = []
    var sign = 'CROSS_STORAGE'

    // 发送
    function send (type, data, callback) {
        var msg = {
            sign: sign,
            type: type,
            data: data
        }

        if (typeof callback === 'function') {
            var token = 'cs_' + (new Date()).getTime()

            msg.token = token
            sendSuccessCallbacks[token] = callback
        }

        try {
            msg = JSON.stringify(msg)
        } catch (e) {
            return
        }

        proxyReady(function(target){
            target.postMessage(msg, '*')
        })
    }

    // 接收
    if ( 'addEventListener' in document ) {
        window.addEventListener('message', receive, false);
    }
    else if ( 'attachEvent' in document ) {
        window.attachEvent('onmessage', receive);
    }

    function receive (msg) {
        if ( !(/\.huya\.com$/.test(msg.origin)) ) return;

        var data = null

        try {
            data = JSON.parse(msg.data)
        } catch (e) {}

        // 拆包
        if (data && data.sign === sign) {

            if (data.token) {
                if (data.token === 'STORE_CHANGE') {
                    $.each(storeChangeCallbacks, function(i, callback){
                        callback(data.data)
                    })
                } else {
                    sendSuccessCallbacks[data.token](data.data)
                }
            }

        }
    }

    // step
    crossStorage.setItem = function (key, val) {
        if (typeof key !== 'string') return;

        var data = {}
        data[key] = val

        send('set', data)
    }

    crossStorage.getItem = function (key, callback) {
        if (typeof key !== 'string') return;

        send('get', key, callback)
    }

    crossStorage.removeItem = function (key) {
        if (typeof key !== 'string') return;

        send('del', key)
    }

    crossStorage.clear = function () {
        send('del')
    }

    crossStorage.change = function (callback) {
        if (typeof callback === 'function') {
            storeChangeCallbacks.push(callback)
            proxyReady()
        }
    }
})(window, jQuery);