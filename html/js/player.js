/**
 * $Id
 **/

var player = {
    worker: null,
    ctx: null, videos: [], max: 20, cache: 5, tid: 0,
    pstore: 0, pplay: 0, tb: 0, tn: 0,
    gray_ctx: null, gray_img: null, do_gray: false,

    play: function() {
        var _img, _fps, _qsiz;
        var _pxdata, _x, _y, _p, _f;

        _img = player.videos[player.pplay].img;
        _fps = player.videos[player.pplay].fps;
	console.log(_fps);
        if (!_img || !_img.width) {
            console.log('img is not ready');
            clearTimeout(player.tid);
            player.tid = 0;
            return;
        }
        player.tb = (player.tn != 0) ? player.tn : Date.now();
        player.ctx.drawImage(_img, 0, 0);
        if (player.do_gray) {
            _pxdata = player.ctx.getImageData(0, 0,
                                              player.gray_img.width,
                                              player.gray_img.height);
            for (_y = 0; _y < _pxdata.height; _y++) {
                for (_x = 0; _x < _pxdata.width; _x++) {
                    _p = (_y * _pxdata.width + _x) * 4;
                    /**
                     * too slow.
                     * 
                     * _f = _pxdata.data[_p] * 0.299 +
                     *      _pxdata.data[_p + 1] * 0.114 +
                     *      _pxdata.data[_p + 2] * 0.587;
                     **/
                    _f = (_pxdata.data[_p] +
                          _pxdata.data[_p + 1] +
                          _pxdata.data[_p + 2]) / 3;
                    player.gray_img.data[_p] = _f;
                    player.gray_img.data[_p + 1] = _f;
                    player.gray_img.data[_p + 2] = _f;
                }
            }
            player.gray_ctx.putImageData(player.gray_img, 0, 0);
        }
        player.pplay++;
        if (player.pplay > player.max - 1) {
            player.pplay = 0;
        }
        if (player.pplay == player.pstore) {
            console.log('under flow');
            clearTimeout(player.tid);
            player.tid = 0;
            player.tn = player.tb;
            return;
        }
        if (player.pplay < player.pstore) {
            _qsiz = player.pstore - player.pplay;
        } else {
            _qsiz = player.pstore + (player.max - player.pplay);
        }
        $('#sfps').text('orig: ' + _fps.toFixed(2) + ' fps');
        player.tn = Date.now();
        if (player.tb != 0) {
            $('#rfps').text('draw: ' + (1000 / (player.tn - player.tb)).toFixed(2) + ' fps');
            $('#rfps').css('opacity', '1.0');
            player.tb = player.tn;
        }
        player.tid = setTimeout(player.play, 1000.0 / _fps, false);
    },
    onmessage: function(msg) {
        var _obj, _i, _qsiz, _tgt;

        _obj = msg.data;
        if (_obj.event) {
            console.log('event: ' + _obj.event);
            if (_obj.event == 'disc') {
                _tgt = (player.do_gray) ? $('#gray') : $('#view');
                _tgt.css('opacity', '0.5');
                if (_tgt.css('-webkit-animation-name') == 'rotate-y') {
                    _tgt.css('-webkit-animation-name', '');
                    $('#do_rotate').text('anim(CSS)');
                }
                $('#loading').css('opacity', '1.0');
                $('#sfps').text('N/A');
                $('#rfps').css('opacity', '0.0');
                if (player.tid) {
                    clearTimeout(player.tid);
                    player.tid = 0;
                }
                player.pstore = 0;
                player.pplay = 0;
            }
            if (_obj.event == 'disc') {
                player.pstore = 0;
                player.pplay = 0;
            }
            return;
        }
        for (_i = 0; _i < _obj.length; _i++) {
            player.videos[player.pstore].img.src = _obj[_i].jpg;
            player.videos[player.pstore].fps = _obj[_i].fps;
            player.pstore++;
            if (player.pstore > player.max - 1) {
                player.pstore = 0;
            }
            if (player.pplay == 0) {
                if (player.pstore == player.max - 1) {
                    console.log('overflow: ', _obj.length - _i, ' frms');
                    break;
                }
            } else {
                if (player.pstore == (player.pplay - 1)) {
                    console.log('overflow: ', _obj.length - _i, ' frms');
                    break;
                }
            }
        }
        if (player.pplay < player.pstore) {
            _qsiz = player.pstore - player.pplay;
        } else {
            _qsiz = player.pstore + (player.max - player.pplay);
        }
        console.log('queue siz: ', _qsiz);
        if (player.tid == 0) {
            $('#loading').css('opacity', '0.0');
            if (player.do_gray) {
                $('#gray').css('opacity', '1.0');
            } else {
                $('#view').css('opacity', '1.0');
            }
            player.tb = Date.now();
            player.tid = setTimeout(player.play, 0, false);
        }
    },
    create: function() {
        var _i, _x, _y;

        player.ctx = $('#view')[0].getContext('2d');
        player.gray_ctx = $('#gray')[0].getContext('2d');
        player.gray_img = player.gray_ctx.createImageData($('#gray')[0].width,
                                                          $('#gray')[0].height);
        for (_y = 0; _y < $('#gray')[0].height; _y++) {
            for (_x = 0; _x < $('#gray')[0].width; _x++) {
                _p = (_y * $('#gray')[0].width + _x) * 4;
                player.gray_img.data[_p + 3] = 255;
            }
        }
        for (_i = 0; _i < player.max; _i++) {
            var _img = new Image();
            player.videos.push({'fps':0, 'img':_img});
        }
        player.worker = new Worker('js/websocket_in_worker.js');
        player.worker.onmessage = player.onmessage;
        player.worker.postMessage({'cmd':'init',
				   'host': '127.0.0.1',
				   'port': 8000,
				   'resource': 'player',
                                   'cache':player.cache});
	player.worker.postMessage({'cmd': 'start'});
        return;
    }
};

/* EOF */
