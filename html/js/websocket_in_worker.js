/*
 * $Id
 */

importScripts('websocket_chunk.js');

var websocket_in_worker = {
    DEFAULT_CACHE: 3,
    videos: [], cache: 0,

    onopen: function(json) {
        postMessage(json);
    },
    onclose: function(json) {
        postMessage(json);
    },
    onmessage: function(json) {
	websocket_in_worker.videos.push(json);
        if (websocket_in_worker.videos.length >= websocket_in_worker.cache) {
            postMessage(websocket_in_worker.videos);
            websocket_in_worker.videos = [];
        }
    }
};

onmessage = function(e) {
    var r;
    var host, port, resource, json;

    if (!e.data.cmd) {
	postMessage({'event': 'invalid args'});
	return;
    }
    if (e.data.cmd == 'init' && (!e.data.host || !e.data.resource)) {
	postMessage({'event': 'invalid args'});
	return;
    }
    host = e.data.host;
    resource = e.data.resource;
    port = (e.data.port) ? e.data.port : 80;
    websocket_in_worker.cache = (e.data.cache) ?
	e.data.cache : websocket_in_worker.DEFAULT_CACHE;
    json = {'host': host, 'port': port, 'resource': resource,
	    'onmessage': websocket_in_worker.onmessage,
	    'onopen': websocket_in_worker.onopen,
	    'onclose': websocket_in_worker.onclose};
    switch (e.data.cmd) {
    case 'init':
        r = websocket_chunk.init(json);
	if (r != websocket_chunk.SUCCESS) {
	    postMessage({'event': 'fail'});
	} else {
	    postMessage({'event': 'success'});
	}
	break;
    case 'start':
	r = websocket_chunk.start();
	if (r != websocket_chunk.SUCCESS) {
	    postMessage({'event': 'fail'});
	} else {
	    postMessage({'event': 'success'});
	}
	break;
    case 'stop':
	websocket_chunk.stop();
	break;
    default:
	postMessage({'event': 'invalid command'});
	break;
    }
}

/* EOF */
