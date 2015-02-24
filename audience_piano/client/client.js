(function ($, server_ip, server_port, fp) {
	// return if no support for websocket or canvas
	if (!window.supports_websocket) {
		alert('Sorry, WebSocket not supported on this browser.');
	}
	if (!window.supports_canvas) {
		alert('Sorry, HTML5 Canvas not supported on this browser.');
	}

	// socket callbacks
	var callback_socket_open = function (event) {
		console.log('socket open');
		
		// send device fingerprint
		var fingerprint = new fp().get();
		socket.send(fingerprint);
	};
	
	var callback_socket_close = function (event) {
		console.log('socket close');
	};
	
	var callback_socket_message = function (event) {
		console.log('socket message: ' + event.data);
	};
	
	var callback_socket_error = function (event) {
		console.log('socket error: ' + event.data);
	};

	// open web socket
	try {
		var server_uri = 'ws://' + String(server_ip) + ':' + String(server_port);
		var socket = new WebSocket(server_uri);
	}
	catch (e) {
		alert('Could not connect to server. Try refreshing.');
	}
	
	// register socket callbacks
	socket.onopen = callback_socket_open;
	socket.onclose = callback_socket_close;
	socket.onmessage = callback_socket_message;
	socket.onerror = callback_socket_error;
	
	// ui callbacks
	var callback_ui_window_resize = function (canvas) {
		return function (event) {
			var browser_viewport_width = $(window).width();
			var browser_viewport_height = $(window).height();
			canvas.width = browser_viewport_width;
			canvas.height = browser_viewport_height;
		};
	};
	
	var callback_canvas_animation = function (canvas) {
		window.animation_frame_request(function () {
			callback_canvas_animation(canvas);
		});
		
		var canvas_ctx = canvas.getContext('2d');
		var canvas_width = canvas.width;
		var canvas_height = canvas.height;
		
		canvas_ctx.fillStyle = 'rgb(255, 0, 255)';
		canvas_ctx.fillRect(0, 0, canvas_width, canvas_height);
		canvas_ctx.fillStyle = 'rgb(0, 0, 255)';
		canvas_ctx.fillRect(8, 8, canvas_width - 16, canvas_height - 16);
		
		// draw white keys
		var key_outline = 2;
		var key_white_width = Math.floor(canvas_width / 7);
		for (var i = 0; i < 7; i++) {
			canvas_ctx.fillStyle = 'rgb(0, 0, 0)';
			canvas_ctx.fillRect(i * key_white_width, 0, key_white_width, canvas_height);
			canvas_ctx.fillStyle = 'rgb(255, 255, 255)';
			canvas_ctx.fillRect(i * key_white_width + key_outline, key_outline, key_white_width - key_outline, canvas_height - key_outline);
		}
	};
	
	var callback_document_ready = function () {
		// remove scrollbars
		$('body').css({'overflow': 'hidden'});
		
		// retrieve canvas DOM
		var canvas = $('canvas#piano').get(0);
		
		// register window resize callback
		callback_ui_window_resize(canvas)();
		$(window).resize(callback_ui_window_resize(canvas));
		
		// start animation
		callback_canvas_animation(canvas);
	};
	
	// register document ready callback
	$(document).ready(callback_document_ready);
	
})(window.jQuery, window.server_ip, window.server_port, window.Fingerprint);