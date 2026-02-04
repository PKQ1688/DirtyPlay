extends Control

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

func _on_connected() -> void:
	_update_status("connected")

func _on_disconnected() -> void:
	_update_status("disconnected")

func _on_error(message: String) -> void:
	_update_status("error: %s" % message)

func _on_joined(_player_id: String) -> void:
	_update_status("joined: %s" % GameManager.player_id)
	get_tree().change_scene_to_file("res://scenes/game_table.tscn")

func _on_connect_pressed() -> void:
	_update_status("connecting...")
	Network.connect_to_server(server_input.text.strip_edges())

func _on_join_pressed() -> void:
	if room_input.text.strip_edges() == "":
		_update_status("room id required")
		return
	GameManager.join(room_input.text.strip_edges(), name_input.text.strip_edges())

func _update_status(text: String) -> void:
	status_label.text = "Status: %s" % text
	connect_button.disabled = false
	join_button.disabled = not Network.is_connected
