(function (options, $, fp) {
	/*
		check for necessary APIs
	*/

	// return if no support for websocket or canvas
	if (!window.supports_websocket) {
		alert('Sorry, WebSocket not supported on this browser.');
	}
	if (!window.supports_canvas) {
		alert('Sorry, HTML5 Canvas not supported on this browser.');
	}

	/*
		state
	*/

	var state = {
		client: {
			mouse_x: -1,
			mouse_y: -1,
			mouse_down: false,
		},
		ui: {
			ui_midi_display_lower: 60,
			ui_midi_display_upper: 71
		}
	};

	/*
		helpers
	*/

	var helpers = {};

	// midi helpers
	helpers.midi = {}

	var _midi_note_names = [
		['C'],
		['C#', 'Db'],
		['D'],
		['D#', 'Eb'],
		['E'],
		['F'],
		['F#', 'Gb'],
		['G'],
		['G#', 'Ab'],
		['A'],
		['A#', 'Bb'],
		['B']];
	helpers.midi.note_number_to_name = function(midi_note_number) {
		while (midi_note_number < 0) {
			midi_note_number += 12;
		}
		dividend = Math.floor(midi_note_number / 12);
		remainder = midi_note_number % 12;
		return _midi_note_names[remainder][0] + String(dividend);
	};

	helpers.midi.note_number_key_white_is = function(midi_note_number) {
		while (midi_note_number < 0) {
			midi_note_number += 12;
		}
		remainder = midi_note_number % 12;
		return 	remainder == 0 ||
				remainder == 2 ||
				remainder == 4 ||
				remainder == 5 ||
				remainder == 7 ||
				remainder == 9 ||
				remainder == 11;
	};
	
	helpers.midi.note_number_key_black_is = function(midi_note_number) {
		return !(helpers.midi_note_number_key_white_is(midi_note_number));
	};

	// ui helpers
	helpers.ui = {}

	helpers.ui.intersect_rect = function(x, y, rect_x, rect_y, rect_width, rect_height) {
		return (rect_x <= x && x < rect_x + rect_width) && (rect_y <= y && y < rect_y + rect_height);
	};

	/*
		socket
	*/
	
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
		var server_uri = 'ws://' + String(options.socket.server_ip) + ':' + String(options.socket.server_port);
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

	/*
		ui
	*/

	// ui callbacks
	var callback_ui_window_resize = function (canvas) {
		return function (event) {
			var browser_viewport_width = $(window).width();
			var browser_viewport_height = $(window).height();
			canvas.width = browser_viewport_width;
			canvas.height = browser_viewport_height;
		};
	};

	var callback_ui_canvas_mouse_move = function (event) {
		ui_state.mouse_x = event.clientX;
		ui_state.mouse_y = event.clientY;
	};

	var callback_ui_canvas_mouse_down = function (event) {
		ui_state.mouse_down = true;
	};

	var callback_ui_canvas_mouse_up = function (event) {
		ui_state.mouse_down = false;
	};

	var callback_ui_canvas_mouse_leave = function (event) {
		ui_state.mouse_x = -1;
		ui_state.mouse_y = -1;
		ui_state.mouse_down = false;
	};

	var callback_ui_canvas_animation = function (canvas) {
		window.animation_frame_request(function () {
			callback_ui_canvas_animation(canvas);
		});
		
		// draw canvas
		var canvas_ctx = canvas.getContext('2d');
		var canvas_width = canvas.width;
		var canvas_height = canvas.height;
		
		// draw debug square to show when we're not filling the canvas
		canvas_ctx.fillStyle = 'rgb(255, 0, 255)';
		canvas_ctx.fillRect(0, 0, canvas_width, canvas_height);
		
		// draw white keys
		var key_outline = 2;
		var key_white_width = Math.floor(canvas_width / 7);
		for (var i = 0; i < 7; i++) {
			var rect_x = i * key_white_width;
			var rect_y = 0;
			var rect_width = key_white_width;
			var rect_height = canvas_height;
			canvas_ctx.fillStyle = options.ui.key_white_outline;
			canvas_ctx.fillRect(rect_x, rect_y, rect_width, rect_height);
			if (helpers.ui.intersect_rect(ui_state.mouse_x, ui_state.mouse_y, rect_x, rect_y, rect_width, rect_height)) {
				if (ui_state.mouse_down) {
					canvas_ctx.fillStyle = options.ui.key_white_down_color;
				}
				else {
					canvas_ctx.fillStyle = options.ui.key_white_hover_color;
				}
			}
			else {
				canvas_ctx.fillStyle = options.ui.key_white_color;
			}
			canvas_ctx.fillRect(i * key_white_width + key_outline, key_outline, key_white_width - (key_outline * 2), canvas_height - (key_outline * 2));
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
		
		// register mouse move callback
		$(canvas).on('mousemove', callback_ui_canvas_mouse_move);
		$(canvas).on('mousedown', callback_ui_canvas_mouse_down);
		$(canvas).on('mouseup', callback_ui_canvas_mouse_up);
		$(canvas).on('mouseleave', callback_ui_canvas_mouse_leave);

		// start animation
		callback_ui_canvas_animation(canvas);
	};
	
	// register document ready callback
	$(document).ready(callback_document_ready);
	
})(window.client_options, window.jQuery, window.Fingerprint);