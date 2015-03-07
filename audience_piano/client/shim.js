(function () {
	// Shim by Paul Irish
	// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
	window.animation_frame_request = (function () {
	  return  window.requestAnimationFrame ||
			  window.webkitRequestAnimationFrame ||
			  window.mozRequestAnimationFrame ||
			  window.oRequestAnimationFrame ||
			  window.msRequestAnimationFrame ||
			  function (callback) {
				  window.setTimeout(callback, 1000 / 60);
			  };
	})();
	
	window.supports_websocket = 'WebSocket' in window || 'MozWebSocket' in window;
	window.supports_canvas = (function() {
		var elem = document.createElement('canvas');
		return !!(elem.getContext && elem.getContext('2d'));
	})();
	window.supports_touch_events = 'ontouchstart' in window || 'onmsgesturechange' in window;
})();