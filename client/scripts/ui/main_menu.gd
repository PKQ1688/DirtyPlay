extends Control

const DEBUG_LOG := true

@onready var server_input := $Panel/VBox/ServerRow/ServerInput
@onready var room_input := $Panel/VBox/RoomRow/RoomInput
@onready var name_input := $Panel/VBox/NameRow/NameInput
@onready var status_label := $Panel/VBox/Status
@onready var connect_button := $Panel/VBox/ButtonRow/ConnectButton
@onready var join_button := $Panel/VBox/ButtonRow/JoinButton

func _ready() -> void:
	Network.connected.connect(_on_connected)
	Network.disconnected.connect(_on_disconnected)
	GameManager.joined.connect(_on_joined)
	GameManager.error_received.connect(_on_error)
	_update_status("disconnected")
	if DEBUG_LOG:
		print("MainMenu ready")
	if _is_auto_join_enabled():
		call_deferred("_auto_connect_and_join")

func _on_connected() -> void:
	_update_status("connected")
	if DEBUG_LOG:
		print("MainMenu connected")

func _on_disconnected() -> void:
	_update_status("disconnected")
	if DEBUG_LOG:
		print("MainMenu disconnected")

func _on_error(message: String) -> void:
	_update_status("error: %s" % message)
	if DEBUG_LOG:
		print("MainMenu error: %s" % message)

func _on_joined(_player_id: String) -> void:
	_update_status("joined: %s" % GameManager.player_id)
	if DEBUG_LOG:
		print("MainMenu joined: %s" % GameManager.player_id)
	get_tree().change_scene_to_file("res://scenes/game_table.tscn")

func _on_connect_pressed() -> void:
	_update_status("connecting...")
	Network.connect_to_server(server_input.text.strip_edges())
	if DEBUG_LOG:
		print("MainMenu connect pressed: %s" % server_input.text.strip_edges())

func _on_join_pressed() -> void:
	if room_input.text.strip_edges() == "":
		_update_status("room id required")
		if DEBUG_LOG:
			print("MainMenu join blocked: room id required")
		return
	GameManager.join(room_input.text.strip_edges(), name_input.text.strip_edges())
	if DEBUG_LOG:
		print("MainMenu join pressed: %s" % room_input.text.strip_edges())

func _update_status(text: String) -> void:
	status_label.text = "Status: %s" % text
	connect_button.disabled = false
	join_button.disabled = not Network.is_connected

func _is_auto_join_enabled() -> bool:
	for arg in OS.get_cmdline_user_args():
		var trimmed := arg.strip_edges()
		if trimmed.begins_with("--"):
			trimmed = trimmed.substr(2)
		if trimmed == "auto_join=1" or trimmed == "auto_join=true":
			return true
	return false

func _auto_connect_and_join() -> void:
	if DEBUG_LOG:
		print("MainMenu auto join enabled")
	_on_connect_pressed()
	var timeout_at := Time.get_ticks_msec() + 5000
	while not Network.is_connected and Time.get_ticks_msec() < timeout_at:
		await get_tree().process_frame
	if not Network.is_connected:
		_update_status("auto connect failed")
		return
	_on_join_pressed()
