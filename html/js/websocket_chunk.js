/*
 * $Id
 */

var websocket_chunk = {
    /* ERROR CODES */
    SUCCESS: 0, INVALID_ARGS: -1, INVALID_JSON: -2, INVALID_STATE: -3,
    /* static vals */
    ws: null, url: '', onopen: null, onclose: null, onmessage: null,
    ptr: 0, depth: 0, msg: '',

    _findJSON: function(msg) {
        for (; websocket_chunk.ptr < msg.length; websocket_chunk.ptr++) {
            websocket_chunk.depth =
                websocket_chunk.depth +
                (msg[websocket_chunk.ptr] == '{') -
                (msg[websocket_chunk.ptr] == '}');

            if (websocket_chunk.depth < 0) {
                return true; /* INVALID JSON */
            }
            if (websocket_chunk.depth == 0 && websocket_chunk.ptr > 0) {
                return true;
            }
        }
        return false;
    },
    _onopen: function() {
	if (websocket_chunk.onopen) {
	    websocket_chunk.onopen({'event': 'conn',
                                    'tgt': websocket_chunk.url});
	} else if (typeof(window) == 'object' && window.console) {
            console.log('open: ' + websocket_chunk.url);
	}
    },
    _onclose: function() {
	if (websocket_chunk.onclose) {
	    websocket_chunk.onclose({'event': 'disc',
                                     'tgt': websocket_chunk.url});
	} else if (typeof(window) == 'object' && window.console) {
            console.log('close: ' + websocket_chunk.url);
        }
        delete websocket_chunk.ws;
        websocket_chunk.ws = null;
    },
    _onmessage: function(msg) {
        var _str, _obj;

        if (websocket_chunk.msg.length > 0) {
            websocket_chunk.msg += msg.data;
        } else {
            websocket_chunk.msg = msg.data;
        }
        while(websocket_chunk._findJSON(websocket_chunk.msg)) {
            _str = websocket_chunk.msg.slice(0, websocket_chunk.ptr + 1);
	    try {
		_obj = JSON.parse(_str);
	    } catch (e) {
                if (typeof(window) == 'object' && window.console) {
                    console.log('invalid JSON');
                    console.log(_str);
                }
                _obj = null;
 	    }
            websocket_chunk.msg = websocket_chunk.msg.substr(websocket_chunk.ptr + 1);
            websocket_chunk.ptr = 0;
            if (_obj) {
                websocket_chunk.onmessage(_obj);
            }
        }
    },
    init: function(args) {
        if (!args || !args.host || !args.resource || !args.onmessage) {
            return websocket_chunk.INVALID_ARGS;
        }
        if (websocket_chunk.ws) {
            return websocket_chunk.INVALID_STATE;
        }
        websocket_chunk.url = 'ws://' + args.host;
        if (args.port) {
            websocket_chunk.url = websocket_chunk.url + ':' + args.port;
        }
        websocket_chunk.url = websocket_chunk.url + '/' + args.resource;
        websocket_chunk.onopen = (args.onopen) ? args.onopen : null;
        websocket_chunk.onclose = (args.onclose) ? args.onclose : null;
        websocket_chunk.onmessage = args.onmessage;
        delete websocket_chunk.msg;
        websocket_chunk.msg = '';
        websocket_chunk.ptr = 0;
        websocket_chunk.depth = 0;
        if (typeof(window) == 'object' && window.console) {
            console.log('websocket uri: ' + websocket_chunk.url);
        }
        return websocket_chunk.SUCCESS;
    },
    start: function() {
        if (websocket_chunk.url == '') {
            return websocket_chunk.INVALID_ARGS;
        }
        if (websocket_chunk.ws) {
            return websocket_chunk.INVALID_STATE;
        }
        if (typeof(window) == 'object' && window.console) {
            console.log('try to connect');
        }
        websocket_chunk.ws = new WebSocket(websocket_chunk.url);
        websocket_chunk.ws.onopen = websocket_chunk._onopen;
        websocket_chunk.ws.onclose = websocket_chunk._onclose;
        websocket_chunk.ws.onmessage = websocket_chunk._onmessage;
        return websocket_chunk.SUCCESS;
    },
    stop: function() {
        if (websocket_chunk.ws) {
            websocket_chunk.ws.onclose = null;
        }
        if (websocket_chunk.ws && websocket_chunk.ws.readyState < 2) {
            if (typeof(window) == 'object' && window.console) {
                console.log('closing websocket');
            }
            websocket_chunk.ws.close();
        } else if (websocket_chunk.ws) {
            delete websocket_chunk.ws;
            websocket_chunk.ws = null;
        }
        delete websocket_chunk.msg;
        websocket_chunk.msg = '';
        websocket_chunk.ptr = 0;
        websocket_chunk.depth = 0;
        return websocket_chunk.SUCCESS;
    }
};

/* EOF */
