extends Node

signal connected
signal disconnected
signal message_received(message)

const DEBUG_LOG := true

var ws := WebSocketPeer.new()
var url := "ws://localhost:8080/ws"
var is_connected := false
var last_ready_state := -1

func _ready() -> void:
	set_process(true)

func connect_to_server(new_url := "") -> void:
	if new_url != "":
		url = new_url
	if DEBUG_LOG:
		print("Network connect_to_server: %s" % url)
	var state := ws.get_ready_state()
	if state == WebSocketPeer.STATE_OPEN:
		is_connected = true
		emit_signal("connected")
		return
	if state == WebSocketPeer.STATE_CONNECTING:
		return
	if state != WebSocketPeer.STATE_CLOSED:
		ws.close()
	ws = WebSocketPeer.new()
	is_connected = false
	var err := ws.connect_to_url(url)
	if err != OK:
		emit_signal("disconnected")
		push_error("WebSocket connect failed: %s" % err)
		return
	set_process(true)

func send_message(msg_type: String, payload: Dictionary, seq: int = 0) -> void:
	if ws.get_ready_state() != WebSocketPeer.STATE_OPEN:
		return
	if DEBUG_LOG:
		print("Network send: %s" % msg_type)
	var msg := {
		"type": msg_type,
		"seq": seq,
		"payload": payload,
	}
	ws.send_text(JSON.stringify(msg))

func _process(_delta: float) -> void:
	ws.poll()
	var state := ws.get_ready_state()
	if state != last_ready_state:
		print("WS state: %s" % state)
		last_ready_state = state
	if state == WebSocketPeer.STATE_CLOSED or state == WebSocketPeer.STATE_CLOSING:
		if is_connected:
			is_connected = false
			emit_signal("disconnected")
		return
	if state == WebSocketPeer.STATE_OPEN and not is_connected:
		is_connected = true
		emit_signal("connected")
	if state == WebSocketPeer.STATE_OPEN:
		while ws.get_available_packet_count() > 0:
			var packet := ws.get_packet().get_string_from_utf8()
			var parsed: Variant = JSON.parse_string(packet)
			if typeof(parsed) == TYPE_DICTIONARY:
				if DEBUG_LOG:
					print("Network recv: %s" % packet)
				emit_signal("message_received", parsed)
