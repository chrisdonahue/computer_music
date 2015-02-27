(function (options, $, fp) {
	/*
		check for necessary APIs
	*/

	// return if no support for websocket or canvas
	if (!window.supports_websocket) {
		alert('Sorry, WebSocket not supported on this browser.');
		throw 'WebSocket not supported on this browser';
	}
	if (!window.supports_canvas) {
		alert('Sorry, HTML5 Canvas not supported on this browser.');
		throw 'HTML5 Canvas not supported on this browser';
	}

	/*
		state
	*/

	var state = {
		client: {
			mouse_down: false,
			midi_note_number: null,
			midi_note_velocity: 127
		},
		ui: {
			width_px: null,
			height_px: null,
			canvas_buffer_dirty: false,
			midi_note_number_display_lower: null,
			midi_note_number_display_upper: null,
			midi_note_number_to_bounding_box: null
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

	
	helpers.midi.note_number_key_white_is = (function() {
		var midi_note_number_key_white_is_cache = {};
		return function(midi_note_number) {
			// return memoized
			if (midi_note_number in midi_note_number_key_white_is_cache) {
				return midi_note_number_key_white_is_cache[midi_note_number];
			}

			// otherwise calculate
			while (midi_note_number < 0) {
				midi_note_number += 12;
			}
			remainder = midi_note_number % 12;
			var midi_note_number_key_white_is =  	remainder === 0 ||
													remainder === 2 ||
													remainder === 4 ||
													remainder === 5 ||
													remainder === 7 ||
													remainder === 9 ||
													remainder === 11;

			// memoize
			midi_note_number_key_white_is_cache[midi_note_number] = midi_note_number_key_white_is;

			// return result
			return midi_note_number_key_white_is;
		};
	})();
	
	helpers.midi.note_number_key_black_is = function(midi_note_number) {
		return !(helpers.midi.note_number_key_white_is(midi_note_number));
	};

	// ui helpers
	helpers.ui = {};

	helpers.ui.midi_note_number_to_bounding_box_recalculate = function() {
		state.ui.midi_note_number_to_bounding_box = {};

		// count white keys
		var keys_white_total = 0;
		for (var midi_note_number = state.ui.midi_note_number_display_lower; midi_note_number <= state.ui.midi_note_number_display_upper; midi_note_number++) {
			if (helpers.midi.note_number_key_white_is(midi_note_number)) {
				keys_white_total++;
			}
		}

		// create bounding boxes
		var key_white_width = Math.floor(state.ui.width_px / keys_white_total);
		var canvas_width_remainder = Math.floor(state.ui.width_px % keys_white_total);
		var key_white_width_extra_every = Math.floor(keys_white_total / canvas_width_remainder);
		var key_white_height = state.ui.height_px;
		var key_black_width = key_white_width * 0.7;
		var key_black_height = key_white_height * 0.6;
		var key_black_offset = key_white_width * 0.35;
		var keys_white_calculated = 0;
		var keys_black_calculated = 0;
		var canvas_width_covered = 0;
		for (midi_note_number = state.ui.midi_note_number_display_lower; midi_note_number <= state.ui.midi_note_number_display_upper; midi_note_number++) {
			var bounding_box = {};

			// white key bounding box
			if (helpers.midi.note_number_key_white_is(midi_note_number)) {
				bounding_box.x = canvas_width_covered;
				bounding_box.y = 0;
				bounding_box.width = key_white_width;
				bounding_box.height = key_white_height;
				// add extra space every few notes to fill in remainder
				if (keys_white_calculated === keys_white_total - 1) {
					bounding_box.width += canvas_width_remainder;
					canvas_width_remainder = 0;
				}
				else if (keys_white_calculated % key_white_width_extra_every === 0 && canvas_width_remainder > 0) {
					bounding_box.width += 1;
					canvas_width_remainder--;
				}
				keys_white_calculated++;
				canvas_width_covered += bounding_box.width;
			}
			// black key bounding box
			else {
				bounding_box.x = canvas_width_covered - key_black_offset;
				bounding_box.y = 0;
				bounding_box.width = key_black_width;
				bounding_box.height = key_black_height;
				keys_black_calculated++;
			}

			state.ui.midi_note_number_to_bounding_box[midi_note_number] = bounding_box;
		}
		
		// mark 
		state.ui.canvas_buffer_dirty = true;
	};

	helpers.ui.midi_note_number_to_bounding_box = function(midi_note_number) {
		// return cached result
		if (state.ui.midi_note_number_to_bounding_box !== null) {
			if (midi_note_number in state.ui.midi_note_number_to_bounding_box) {
				return state.ui.midi_note_number_to_bounding_box[midi_note_number];
			}
			else {
				return null;
			}
		}
		throw 'helpers.ui.note_number_to_bounding_box: called before helpers.ui.note_number_to_bounding_box_recalculate';
	};

	helpers.ui.note_number_display_range_set = function(lower, upper) {
		if (lower > upper) {
			throw 'helpers.ui.note_number_display_range_set: value range invalid';
		}
		state.ui.midi_note_number_display_lower = lower;
		state.ui.midi_note_number_display_upper = upper;
		helpers.ui.midi_note_number_to_bounding_box_recalculate();
	};

	helpers.ui.intersect_bounding_box = function(x, y, bounding_box) {
		return (bounding_box.x <= x && x < bounding_box.x + bounding_box.width) && (bounding_box.y <= y && y < bounding_box.y + bounding_box.height);
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
			state.ui.width_px = browser_viewport_width;
			state.ui.height_px = browser_viewport_height;
			helpers.ui.midi_note_number_to_bounding_box_recalculate();
		};
	};

	var mouse_process_event = function (event) {
		var mouse_x = event.clientX;
		var mouse_y = event.clientY;
		state.client.midi_note_number = null;

		// try black keys
		for (var midi_note_number = state.ui.midi_note_number_display_lower; midi_note_number <= state.ui.midi_note_number_display_upper; midi_note_number++) {
			if (helpers.midi.note_number_key_white_is(midi_note_number)) {
				continue;
			}

			var bb = helpers.ui.midi_note_number_to_bounding_box(midi_note_number);
			if (helpers.ui.intersect_bounding_box(mouse_x, mouse_y, bb)) {
				state.client.midi_note_number = midi_note_number;
				return;
			}
		}

		// try white keys
		for (var midi_note_number = state.ui.midi_note_number_display_lower; midi_note_number <= state.ui.midi_note_number_display_upper; midi_note_number++) {
			if (helpers.midi.note_number_key_black_is(midi_note_number)) {
				continue;
			}

			var bb = helpers.ui.midi_note_number_to_bounding_box(midi_note_number);
			if (helpers.ui.intersect_bounding_box(mouse_x, mouse_y, bb)) {
				state.client.midi_note_number = midi_note_number;
				return;
			}
		}
	};

	var callback_ui_canvas_mouse_move = function (event) {
		mouse_process_event(event);
	};

	var callback_ui_canvas_mouse_down = function (event) {
		mouse_process_event(event);
		state.client.mouse_down = true;
		if (state.client.midi_note_number !== null) {
			socket.send('on:' + String(state.client.midi_note_number) + ' ' + String(state.client.midi_note_velocity));
		}
	};

	var callback_ui_canvas_mouse_up = function (event) {
		mouse_process_event(event);
		if (state.client.midi_note_number !== null && state.client.mouse_down === true) {
			socket.send('off:' + String(state.client.midi_note_number));
		}
		state.client.mouse_down = false;
		state.client.midi_note_number = null;
	};

	var callback_ui_canvas_mouse_leave = function (event) {
		if (state.client.midi_note_number !== null && state.client.mouse_down === true) {
			socket.send('off:' + String(state.client.midi_note_number));
		}
		state.client.mouse_down = false;
		state.client.midi_note_number = null;
	};

	var callback_ui_canvas_animation = (function () {
		var canvas_buffer = document.createElement('canvas');
		return function (canvas) {
			window.animation_frame_request(function () {
				callback_ui_canvas_animation(canvas);
			});
			
			// get canvas dimensions
			var canvas_width = state.ui.width_px;
			var canvas_height = state.ui.height_px;

			// redraw buffer if we need to
			if (state.ui.canvas_buffer_dirty) {
				// resize buffer
				canvas_buffer.width = canvas_width;
				canvas_buffer.height = canvas_height;
				var canvas_buffer_ctx = canvas.getContext('2d');

				// draw debug square to show when we're not filling the canvas
				canvas_buffer_ctx.fillStyle = 'rgb(255, 0, 255)';
				canvas_buffer_ctx.fillRect(0, 0, canvas_width, canvas_height);

				// draw white keys
				for (var midi_note_number = state.ui.midi_note_number_display_lower; midi_note_number <= state.ui.midi_note_number_display_upper; midi_note_number++) {
					if (!helpers.midi.note_number_key_white_is(midi_note_number)) {
						continue;
					}
					var bb = helpers.ui.midi_note_number_to_bounding_box(midi_note_number);
					canvas_buffer_ctx.fillStyle = options.ui.key_white_outline;
					canvas_buffer_ctx.fillRect(bb.x, bb.y, bb.width, bb.height);
					canvas_buffer_ctx.fillStyle = options.ui.key_white_color;
					var key_outline = Math.max(1, Math.floor(options.ui.key_spacing * bb.width));
					canvas_buffer_ctx.fillRect(bb.x + key_outline, bb.y + key_outline, bb.width - (key_outline * 2), bb.height - (key_outline * 2));
				}

				// draw black keys
				for (var midi_note_number = state.ui.midi_note_number_display_lower; midi_note_number <= state.ui.midi_note_number_display_upper; midi_note_number++) {
					if (helpers.midi.note_number_key_white_is(midi_note_number)) {
						continue;
					}
					var bb = helpers.ui.midi_note_number_to_bounding_box(midi_note_number);
					canvas_buffer_ctx.fillStyle = options.ui.key_black_outline;
					canvas_buffer_ctx.fillRect(bb.x, bb.y, bb.width, bb.height);
					canvas_buffer_ctx.fillStyle = options.ui.key_black_color;
					var key_outline = Math.max(1, Math.floor(options.ui.key_spacing * bb.width));
					canvas_buffer_ctx.fillRect(bb.x + key_outline, bb.y + key_outline, bb.width - (key_outline * 2), bb.height - (key_outline * 2));
				}

				// mark canvas buffer as clean
				state.ui.canvas_buffer_dirty = false;
			}

			// fill in canvas from buffer
			var canvas_ctx = canvas.getContext('2d');
			canvas_ctx.clearRect(0, 0, canvas_width, canvas_height);
			canvas_ctx.drawImage(canvas_buffer, 0, 0);

			// highlight selected note
			if (state.client.midi_note_number !== null) {
				if (helpers.midi.note_number_key_white_is(state.client.midi_note_number)) {
					if (state.client.mouse_down) {
						canvas_ctx.fillStyle = options.ui.key_white_down_color;
					}
					else {
						canvas_ctx.fillStyle = options.ui.key_white_hover_color;
					}
				}
				else {
					if (state.client.mouse_down) {
						canvas_ctx.fillStyle = options.ui.key_black_down_color;
					}
					else {
						canvas_ctx.fillStyle = options.ui.key_black_hover_color;
					}
				}

				var bb = helpers.ui.midi_note_number_to_bounding_box(state.client.midi_note_number);
				var key_outline = Math.max(1, Math.floor(options.ui.key_spacing * bb.width));
				canvas_ctx.fillRect(bb.x + key_outline, bb.y + key_outline, bb.width - (key_outline * 2), bb.height - (key_outline * 2));
			}
		};
	})();

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

		// set initial display range
		helpers.ui.note_number_display_range_set(0, 23);

		// start animation
		callback_ui_canvas_animation(canvas);
	};
	
	// register document ready callback
	$(document).ready(callback_document_ready);
	
})(window.client_options, window.jQuery, window.Fingerprint);