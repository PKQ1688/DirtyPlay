extends Control

@onready var phase_label := $Root/Columns/Left/TablePanel/TableVBox/HeaderRow/PhaseLabel
@onready var turn_label := $Root/Columns/Left/TablePanel/TableVBox/HeaderRow/TurnLabel
@onready var pot_label := $Root/Columns/Left/TablePanel/TableVBox/HeaderRow/PotLabel
@onready var community_label := $Root/Columns/Left/TablePanel/TableVBox/CommunityLabel
@onready var hand_label := $Root/Columns/Left/TablePanel/TableVBox/HandLabel
@onready var heat_label := $Root/Columns/Left/TablePanel/TableVBox/HeatLabel
@onready var skills_label := $Root/Columns/Left/TablePanel/TableVBox/SkillsLabel
@onready var players_list := $Root/Columns/Left/PlayersPanel/PlayersVBox/PlayersList
@onready var to_call_label := $Root/Columns/Right/ActionsPanel/ActionsVBox/CallInfo/ToCallLabel
@onready var min_raise_label := $Root/Columns/Right/ActionsPanel/ActionsVBox/CallInfo/MinRaiseLabel
@onready var fold_button := $Root/Columns/Right/ActionsPanel/ActionsVBox/Buttons/FoldButton
@onready var check_button := $Root/Columns/Right/ActionsPanel/ActionsVBox/Buttons/CheckButton
@onready var call_button := $Root/Columns/Right/ActionsPanel/ActionsVBox/Buttons/CallButton
@onready var raise_button := $Root/Columns/Right/ActionsPanel/ActionsVBox/Buttons/RaiseButton
@onready var allin_button := $Root/Columns/Right/ActionsPanel/ActionsVBox/Buttons/AllInButton
@onready var raise_input := $Root/Columns/Right/ActionsPanel/ActionsVBox/RaiseRow/RaiseInput
@onready var skill_buttons := $Root/Columns/Right/SkillsPanel/SkillsVBox/SkillButtons
@onready var selected_skill_label := $Root/Columns/Right/SkillsPanel/SkillsVBox/SelectRow/SelectedSkillLabel
@onready var target_option := $Root/Columns/Right/SkillsPanel/SkillsVBox/SelectRow/TargetOption
@onready var card_idx_option := $Root/Columns/Right/SkillsPanel/SkillsVBox/SelectRow/CardIdxOption
@onready var use_skill_button := $Root/Columns/Right/SkillsPanel/SkillsVBox/SelectRow/UseSkillButton
@onready var status_label := $Root/Columns/Right/StatusLabel

var current_actions: Array = []
var current_req := {}
var selected_skill_id := ""
var target_ids: Array = []
var last_state := {}

func _ready() -> void:
	GameManager.state_updated.connect(_on_state_updated)
	GameManager.action_requested.connect(_on_action_requested)
	GameManager.skill_effect.connect(_on_skill_effect)
	GameManager.error_received.connect(_on_error)
	_setup_card_idx()
	target_option.visible = false
	card_idx_option.visible = false
	use_skill_button.disabled = true
	_update_state(GameManager.state)
	_update_actions({})

func _setup_card_idx() -> void:
	card_idx_option.clear()
	card_idx_option.add_item("Card 0")
	card_idx_option.add_item("Card 1")
	card_idx_option.selected = 0

func _on_state_updated(state: Dictionary) -> void:
	_update_state(state)

func _on_action_requested(req: Dictionary) -> void:
	_update_actions(req)

func _on_error(message: String) -> void:
	status_label.text = "Status: %s" % message

func _on_skill_effect(effect: Dictionary) -> void:
	var skill_id := effect.get("skill_id", "")
	var blocked := effect.get("blocked", false)
	var result := effect.get("result", {})
	if blocked:
		status_label.text = "Skill %s blocked" % skill_id
	else:
		if typeof(result) == TYPE_DICTIONARY and result.has("card"):
			status_label.text = "Skill %s result: %s" % [skill_id, result["card"]]
		else:
			status_label.text = "Skill %s used" % skill_id

func _update_state(state: Dictionary) -> void:
	if state.is_empty():
		return
	last_state = state
	phase_label.text = "Phase: %s" % state.get("phase", "")
	turn_label.text = "Current: %s" % state.get("current_player", "")
	pot_label.text = "Pot: %d" % int(state.get("total_pot", 0))
	community_label.text = "Community: %s" % ", ".join(state.get("community_cards", []))
	hand_label.text = "My Hand: %s" % ", ".join(state.get("my_hand", []))
	heat_label.text = "Heat: %d" % int(state.get("my_heat", 0))
	var is_my_turn := state.get("current_player", "") == GameManager.player_id
	_update_action_buttons(is_my_turn)
	_refresh_skills(state.get("my_skills", []))
	_refresh_targets(state.get("players", []))
	_update_skill_controls()
	var skills := []
	for s in state.get("my_skills", []):
		if typeof(s) == TYPE_DICTIONARY:
			skills.append("%s(%s)" % [s.get("name", ""), s.get("id", "")])
	skills_label.text = "Skills: %s" % ", ".join(skills)

	players_list.clear()
	for p in state.get("players", []):
		if typeof(p) != TYPE_DICTIONARY:
			continue
		var prefix := ""
		if p.get("id", "") == state.get("current_player", ""):
			prefix = ">> "
		var line := "%s%s (%s) | seat %s | stack %s | bet %s | %s" % [
			prefix,
			p.get("name", ""),
			p.get("id", ""),
			str(p.get("seat", "")),
			str(p.get("stack", "")),
			str(p.get("bet", "")),
			p.get("status", ""),
		]
		if p.get("heat_warning", false):
			line += " | suspicious"
		if p.has("hand") and p["hand"].size() > 0:
			line += " | hand: %s" % ", ".join(p["hand"])
		players_list.add_item(line)

func _update_actions(req: Dictionary) -> void:
	current_req = req
	current_actions = req.get("valid_actions", [])
	var to_call := int(req.get("to_call", 0))
	var min_raise := int(req.get("min_raise", 0))
	to_call_label.text = "To Call: %d" % to_call
	min_raise_label.text = "Min Raise: %d" % min_raise
	if current_actions.has("raise"):
		var my_bet := _my_current_bet()
		raise_input.text = str(my_bet + to_call + min_raise)
	_update_action_buttons(true)

func _update_action_buttons(is_my_turn: bool) -> void:
	if not is_my_turn:
		fold_button.disabled = true
		check_button.disabled = true
		call_button.disabled = true
		raise_button.disabled = true
		allin_button.disabled = true
		return
	fold_button.disabled = not current_actions.has("fold")
	check_button.disabled = not current_actions.has("check")
	call_button.disabled = not current_actions.has("call")
	raise_button.disabled = not current_actions.has("raise")
	allin_button.disabled = not current_actions.has("all_in")

func _refresh_skills(skills: Array) -> void:
	for child in skill_buttons.get_children():
		child.queue_free()
	var has_active := false
	var first_active := ""
	for s in skills:
		if typeof(s) != TYPE_DICTIONARY:
			continue
		var skill_id := s.get("id", "")
		var skill_name := s.get("name", skill_id)
		var button := Button.new()
		button.text = skill_name
		button.disabled = skill_id == "counter"
		button.pressed.connect(_on_skill_button_pressed.bind(skill_id))
		skill_buttons.add_child(button)
		has_active = true
		if first_active == "" and skill_id != "counter":
			first_active = skill_id
	if not has_active:
		var label := Label.new()
		label.text = "No skills"
		skill_buttons.add_child(label)
		selected_skill_id = ""
		selected_skill_label.text = "Selected: -"
		return
	if selected_skill_id == "" or selected_skill_id == "counter":
		selected_skill_id = first_active
	selected_skill_label.text = "Selected: %s" % selected_skill_id

func _refresh_targets(players: Array) -> void:
	target_option.clear()
	target_ids = []
	target_option.add_item("Target")
	for p in players:
		if typeof(p) != TYPE_DICTIONARY:
			continue
		if p.get("id", "") == GameManager.player_id:
			continue
		if p.get("status", "") == "folded" or p.get("status", "") == "out":
			continue
		var name := p.get("name", "")
		var pid := p.get("id", "")
		target_option.add_item("%s (%s)" % [name, pid])
		target_ids.append(pid)
	target_option.selected = 0

func _update_skill_controls() -> void:
	selected_skill_label.text = "Selected: %s" % (selected_skill_id if selected_skill_id != "" else "-")
	var is_my_turn := last_state.get("current_player", "") == GameManager.player_id
	var need_target := selected_skill_id == "peek"
	var need_card := selected_skill_id == "swap"
	target_option.visible = need_target
	card_idx_option.visible = need_card
	if not is_my_turn:
		use_skill_button.disabled = true
		return
	if selected_skill_id == "" or selected_skill_id == "counter":
		use_skill_button.disabled = true
		return
	if need_target:
		use_skill_button.disabled = target_option.selected == 0
		return
	use_skill_button.disabled = false

func _on_skill_button_pressed(skill_id: String) -> void:
	selected_skill_id = skill_id
	_update_skill_controls()

func _my_current_bet() -> int:
	if last_state.is_empty():
		return 0
	for p in last_state.get("players", []):
		if typeof(p) == TYPE_DICTIONARY and p.get("id", "") == GameManager.player_id:
			return int(p.get("bet", 0))
	return 0

func _on_fold_pressed() -> void:
	GameManager.send_action("fold")

func _on_check_pressed() -> void:
	GameManager.send_action("check")

func _on_call_pressed() -> void:
	GameManager.send_action("call")

func _on_raise_pressed() -> void:
	var amount := int(raise_input.text)
	GameManager.send_action("raise", amount)

func _on_allin_pressed() -> void:
	GameManager.send_action("all_in")

func _on_use_skill_pressed() -> void:
	if selected_skill_id == "" or selected_skill_id == "counter":
		return
	var target_id := ""
	if selected_skill_id == "peek":
		if target_option.selected <= 0:
			status_label.text = "Select target"
			return
		target_id = target_ids[target_option.selected - 1]
	var card_idx := -1
	if selected_skill_id == "swap":
		card_idx = card_idx_option.selected
	GameManager.use_skill(selected_skill_id, target_id, card_idx)
