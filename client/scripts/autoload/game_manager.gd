extends Node

signal joined(player_id)
signal state_updated(state)
signal action_requested(request)
signal skill_effect(effect)
signal error_received(message)

var player_id := ""
var room_id := ""
var state := {}
var last_action_req := {}

func _ready() -> void:
	Network.message_received.connect(_on_message)
	_load_player_id()

func join(room: String, name: String = "") -> void:
	room_id = room
	var payload := {"room_id": room}
	if player_id != "":
		payload["player_id"] = player_id
	if name != "":
		payload["name"] = name
	Network.send_message("join", payload)

func send_action(action: String, amount: int = 0) -> void:
	var payload := {"action": action}
	if amount > 0:
		payload["amount"] = amount
	Network.send_message("action", payload)

func use_skill(skill_id: String, target_id: String = "", card_idx: int = -1) -> void:
	var payload := {"skill_id": skill_id}
	if target_id != "":
		payload["target_id"] = target_id
	if card_idx >= 0:
		payload["card_idx"] = card_idx
	Network.send_message("skill", payload)

func _on_message(msg: Dictionary) -> void:
	if not msg.has("type"):
		return
	var msg_type := msg["type"]
	var payload := msg.get("payload", {})
	match msg_type:
		"ack":
			if payload.has("player_id"):
				player_id = payload["player_id"]
				_save_player_id()
				emit_signal("joined", player_id)
		"state":
			state = payload
			emit_signal("state_updated", state)
		"action_req":
			last_action_req = payload
			emit_signal("action_requested", last_action_req)
		"skill_effect":
			emit_signal("skill_effect", payload)
		"error":
			if payload.has("message"):
				emit_signal("error_received", payload["message"])
		_:
			pass

func _load_player_id() -> void:
	var path := "user://player_id.txt"
	if FileAccess.file_exists(path):
		var file := FileAccess.open(path, FileAccess.READ)
		if file:
			player_id = file.get_line().strip_edges()

func _save_player_id() -> void:
	var file := FileAccess.open("user://player_id.txt", FileAccess.WRITE)
	if file:
		file.store_line(player_id)
