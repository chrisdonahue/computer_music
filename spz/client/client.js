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
	if (!window.supports_touch_events) {
		alert('Sorry, TouchEvents API not supported on this browser.');
		throw 'TouchEvents API not supported on this browser';
	}

	/*
		state
	*/

	var state = {
		client: {
			mouse_midi_note_number: null,
			midi_note_number_to_touch_id: {},
			touch_id_to_midi_note_number: {},
			midi_note_velocity: 100
		},
		ui: {
			canvas_left_px: null,
			canvas_top_px: null,
			canvas_width_px: null,
			canvas_height_px: null,
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
		var key_white_width = Math.floor(state.ui.canvas_width_px / keys_white_total);
		var canvas_width_remainder = Math.floor(state.ui.canvas_width_px % keys_white_total);
		var key_white_width_extra_every = Math.floor(keys_white_total / canvas_width_remainder);
		var key_white_height = state.ui.canvas_height_px;
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

	helpers.ui.mouse_event_to_canvas_pos = function(event) {
		return {
			x: event.clientX - state.ui.canvas_left_px,
			y: event.clientY - state.ui.canvas_top_px
		};
	};

	helpers.ui.touch_to_canvas_pos = function(touch) {
		return {
			x: touch.clientX - state.ui.canvas_left_px,
			y: touch.clientY - state.ui.canvas_top_px
		};
	};

	helpers.ui.canvas_pos_to_midi_note_number = function (pos) {
		var x = pos.x;
		var y = pos.y;

		// try black keys
		for (var midi_note_number = state.ui.midi_note_number_display_lower; midi_note_number <= state.ui.midi_note_number_display_upper; midi_note_number++) {
			if (helpers.midi.note_number_key_white_is(midi_note_number)) {
				continue;
			}

			var bb = helpers.ui.midi_note_number_to_bounding_box(midi_note_number);
			if (helpers.ui.intersect_bounding_box(x, y, bb)) {
				return midi_note_number;
			}
		}

		// try white keys
		for (var midi_note_number = state.ui.midi_note_number_display_lower; midi_note_number <= state.ui.midi_note_number_display_upper; midi_note_number++) {
			if (helpers.midi.note_number_key_black_is(midi_note_number)) {
				continue;
			}

			var bb = helpers.ui.midi_note_number_to_bounding_box(midi_note_number);
			if (helpers.ui.intersect_bounding_box(x, y, bb)) {
				return midi_note_number;
			}
		}

		// no note pressed (this shouldn't happen)
		return null;
	};

	// client helpers
	helpers.client = {};

	helpers.client.midi_note_number_on = function (midi_note_number) {
		socket.send('1.' + String(midi_note_number) + '.' + String(state.client.midi_note_velocity));
	};

	helpers.client.midi_note_number_off = function (midi_note_number) {
		socket.send('0.' + String(midi_note_number));
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
			var canvas_not_height = $('div#canvas_not').height();
			canvas.width = browser_viewport_width;
			canvas.height = browser_viewport_height - canvas_not_height;
			state.ui.canvas_left_px = canvas.getBoundingClientRect().left;
			state.ui.canvas_top_px = canvas.getBoundingClientRect().top;
			state.ui.canvas_width_px = browser_viewport_width;
			state.ui.canvas_height_px = canvas.height;
			helpers.ui.midi_note_number_to_bounding_box_recalculate();
		};
	};

	var callback_ui_canvas_mouse_move = function (event) {
		var midi_note_number = helpers.ui.canvas_pos_to_midi_note_number(helpers.ui.mouse_event_to_canvas_pos(event));
		helpers.client.midi_note_off_all_except(midi_note_number);
		helpers.client.midi_note_on(midi_note_number);
	};

	var callback_ui_canvas_mouse_down = function (event) {
		var midi_note_number = helpers.ui.canvas_pos_to_midi_note_number(helpers.ui.mouse_event_to_canvas_pos(event));
		helpers.client.midi_note_on(midi_note_number);
	};

	var callback_ui_canvas_mouse_up = function (event) {
		helpers.client.midi_note_off_all();
	};

	var callback_ui_canvas_mouse_leave = function (event) {
		helpers.client.midi_note_off_all();
	};

	var callback_ui_canvas_touch_shim = function (callback) {
		return function(event) {
			if (!('targetTouches' in event)) {
				event = event.originalEvent;
			}
			callback(event);
		};
	};

	var callback_ui_canvas_touch_start = callback_ui_canvas_touch_shim(function (event) {
		for (var i = 0; i < event.changedTouches.length; i++) {
			var touch = event.changedTouches[i];
			var touch_id = touch.identifier;
			var midi_note_number = helpers.ui.canvas_pos_to_midi_note_number(helpers.ui.touch_to_canvas_pos(touch));
			if (!(midi_note_number in state.client.midi_note_number_to_touch_id)) {
				helpers.client.midi_note_number_on(midi_note_number);
				state.client.midi_note_number_to_touch_id[midi_note_number] = touch_id;
				state.client.touch_id_to_midi_note_number[touch_id] = midi_note_number;
			}
		}
	});

	var callback_ui_canvas_touch_move = callback_ui_canvas_touch_shim(function (event) {
		for (var i = 0; i < event.changedTouches.length; i++) {
			var touch = event.changedTouches[i];
			var touch_id = touch.identifier;
			var midi_note_number = helpers.ui.canvas_pos_to_midi_note_number(helpers.ui.touch_to_canvas_pos(touch));
			var touch_id = event.changedTouches[i].identifier;
			if (touch_id in state.client.touch_id_to_midi_note_number) {
				var midi_note_number_old = state.client.touch_id_to_midi_note_number[touch_id];
				if (midi_note_number_old !== midi_note_number) {
					helpers.client.midi_note_number_off(midi_note_number);
					delete state.client.midi_note_number_to_touch_id[midi_note_number_old];
					delete state.client.touch_id_to_midi_note_number[touch_id];
					helpers.client.midi_note_number_on(midi_note_number);
					state.client.midi_note_number_to_touch_id[midi_note_number] = touch_id;
					state.client.touch_id_to_midi_note_number[touch_id] = midi_note_number;
				}
			}
		}
	});

	var callback_ui_canvas_touch_end = callback_ui_canvas_touch_shim(function (event) {
		for (var i = 0; i < event.changedTouches.length; i++) {
			var touch_id = event.changedTouches[i].identifier;
			if (touch_id in state.client.touch_id_to_midi_note_number) {
				var midi_note_number = state.client.touch_id_to_midi_note_number[touch_id];
				helpers.client.midi_note_number_off(midi_note_number);
				delete state.client.midi_note_number_to_touch_id[midi_note_number];
				delete state.client.touch_id_to_midi_note_number[touch_id];
			}
		}
	});

	var callback_ui_canvas_touch_cancel = callback_ui_canvas_touch_shim(function (event) {
		for (var i = 0; i < event.changedTouches.length; i++) {
			var touch_id = event.changedTouches[i].identifier;
			if (touch_id in state.client.touch_id_to_midi_note_number) {
				var midi_note_number = state.client.touch_id_to_midi_note_number[touch_id];
				helpers.client.midi_note_number_off(midi_note_number);
				delete state.client.midi_note_number_to_touch_id[midi_note_number];
				delete state.client.touch_id_to_midi_note_number[touch_id];
			}
		}
	});

	var callback_ui_canvas_touch_leave = callback_ui_canvas_touch_shim(function (event) {
		for (var i = 0; i < event.changedTouches.length; i++) {
			var touch_id = event.changedTouches[i].identifier;
			if (touch_id in state.client.touch_id_to_midi_note_number) {
				var midi_note_number = state.client.touch_id_to_midi_note_number[touch_id];
				helpers.client.midi_note_number_off(midi_note_number);
				delete state.client.midi_note_number_to_touch_id[midi_note_number];
				delete state.client.touch_id_to_midi_note_number[touch_id];
			}
		}
	});

	var callback_ui_midi_note_velocity_change = function(event) {
		var $el = $(this);
		var value_new = Number($el.val());
		state.client.midi_note_velocity = Math.min(value_new, 127);
	};

	var callback_ui_zoom_out_click = function(event) {
		console.log(event);
	};

	var callback_ui_zoom_in_click = function(event) {
		console.log(event);
	};

	var callback_ui_scroll_change = function(event) {
		console.log(event);
	};

	var callback_ui_canvas_animation = (function () {
		var canvas_buffer = document.createElement('canvas');
		return function (canvas) {
			window.animation_frame_request(function () {
				callback_ui_canvas_animation(canvas);
			});
			
			// get canvas dimensions
			var canvas_width = state.ui.canvas_width_px;
			var canvas_height = state.ui.canvas_height_px;

			// redraw buffer if we need to
			if (state.ui.canvas_buffer_dirty) {
				// resize buffer
				canvas_buffer.width = canvas_width;
				canvas_buffer.height = canvas_height;
				var canvas_buffer_ctx = canvas_buffer.getContext('2d');

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
			//canvas_ctx.clearRect(0, 0, canvas_width, canvas_height);
			canvas_ctx.drawImage(canvas_buffer, 0, 0);

			// highlight selected note
			for (var midi_note_number_string in state.client.midi_note_number_to_touch_id) {
				var midi_note_number = Number(midi_note_number_string);
				var key_white_is = helpers.midi.note_number_key_white_is(midi_note_number);

				// set fill color
				if (key_white_is) {
					canvas_ctx.fillStyle = options.ui.key_white_down_color;
				}
				else {
					canvas_ctx.fillStyle = options.ui.key_black_down_color;
				}

				// fill
				var bb = helpers.ui.midi_note_number_to_bounding_box(midi_note_number);
				var key_outline = Math.max(1, Math.floor(options.ui.key_spacing * bb.width));
				canvas_ctx.fillRect(bb.x + key_outline, bb.y + key_outline, bb.width - (key_outline * 2), bb.height - (key_outline * 2));

				// redraw surrounding black keys
				if (key_white_is) {
					var midi_note_number_adjacents = [midi_note_number - 1, midi_note_number + 1];
					canvas_ctx.fillStyle = options.ui.key_black_color;
					for (var i = 0; i < 2; i++) {
						var midi_note_number_adjacent = midi_note_number_adjacents[i];
						if (helpers.midi.note_number_key_white_is(midi_note_number_adjacent)) {
							continue;
						}
						var bb = helpers.ui.midi_note_number_to_bounding_box(midi_note_number_adjacent);
						if (bb !== null) {
							canvas_ctx.fillStyle = options.ui.key_black_outline;
							canvas_ctx.fillRect(bb.x, bb.y, bb.width, bb.height);
							canvas_ctx.fillStyle = options.ui.key_black_color;
							var key_outline = Math.max(1, Math.floor(options.ui.key_spacing * bb.width));
							canvas_ctx.fillRect(bb.x + key_outline, bb.y + key_outline, bb.width - (key_outline * 2), bb.height - (key_outline * 2));
						}
					}
				}
			}
		};
	})();

	var callback_document_ready = function () {
		// remove scrollbars
		$('body').css({'overflow': 'hidden'});
		
		// retrieve canvas DOM
		var canvas = $('div#canvas canvas#piano').get(0);
		
		// register window resize callback
		callback_ui_window_resize(canvas)();
		$(window).resize(callback_ui_window_resize(canvas));

		// resize text
		$('span#prompt').quickfit()

		// register velocity slider callback
		var $slider_midi_note_velocity = $('div#controls input#midi_note_velocity');
		$slider_midi_note_velocity.val(options.client.midi_note_velocity_initial);
		$slider_midi_note_velocity.on('change', callback_ui_midi_note_velocity_change);

		// register ui control callbacks
		$('div#navigation input#zoom_out').on('click', callback_ui_zoom_out_click);
		$('div#navigation input#zoom_in').on('click', callback_ui_zoom_in_click);
		$('div#navigation input#scroll').on('change', callback_ui_scroll_change);

		// register canvas callback
		if (!window.supports_touch_events) {
			//$(canvas).on('mousemove', callback_ui_canvas_mouse_move);
			$(canvas).on('mousedown', callback_ui_canvas_mouse_down);
			$(canvas).on('mouseup', callback_ui_canvas_mouse_up);
			$(canvas).on('mouseleave', callback_ui_canvas_mouse_leave);
		}
		else {
			$(canvas).on('touchstart', callback_ui_canvas_touch_start);
			$(canvas).on('touchmove', callback_ui_canvas_touch_move);
			$(canvas).on('touchend', callback_ui_canvas_touch_end);
			$(canvas).on('touchcancel', callback_ui_canvas_touch_cancel);
			$(canvas).on('touchleave', callback_ui_canvas_touch_leave);
		}

		// set initial display range
		helpers.ui.note_number_display_range_set(options.ui.midi_note_number_display_lower_initial, options.ui.midi_note_number_display_upper_initial);

		// start animation
		callback_ui_canvas_animation(canvas);
	};
	
	// register document ready callback
	$(document).ready(callback_document_ready);
	
})(window.client_options, window.jQuery, window.Fingerprint);
