extends Node

signal connected
signal disconnected
signal message_received(message)

var ws := WebSocketPeer.new()
var url := "ws://localhost:8080/ws"
var is_connected := false

func connect_to_server(new_url := "") -> void:
	if new_url != "":
		url = new_url
	var err := ws.connect_to_url(url)
	if err != OK:
		push_error("WebSocket connect failed: %s" % err)
	set_process(true)

func send_message(msg_type: String, payload: Dictionary, seq: int = 0) -> void:
	if ws.get_ready_state() != WebSocketPeer.STATE_OPEN:
		return
	var msg := {
		"type": msg_type,
		"seq": seq,
		"payload": payload,
	}
	ws.send_text(JSON.stringify(msg))

func _process(_delta: float) -> void:
	if ws.get_ready_state() == WebSocketPeer.STATE_CLOSED:
		if is_connected:
			is_connected = false
			emit_signal("disconnected")
		return
	ws.poll()
	var state := ws.get_ready_state()
	if state == WebSocketPeer.STATE_OPEN and not is_connected:
		is_connected = true
		emit_signal("connected")
	if state == WebSocketPeer.STATE_OPEN:
		while ws.get_available_packet_count() > 0:
			var packet := ws.get_packet().get_string_from_utf8()
			var parsed := JSON.parse_string(packet)
			if parsed != null:
				emit_signal("message_received", parsed)
