-- ~/.config/devilspie2/workspace-rules.lua
-- Mapping app ke workspace

app_rules = {
    -- [window_class] = workspace_number
    ["vesktop"]  = 1,    -- Discord (Vencord/Vesktop)
    ["code"]     = 2,    -- VS Code
    ["google-chrome"] = 3, -- Chrome
    ["navicat"]  = 4,    -- Navicat
    ["gnome-terminal"] = 5, -- GNOME Terminal
    ["postman"]  = 6,    -- Postman
}

-- Helper buat debug (optional)
-- debug_print("Window name: " .. get_window_name())
-- debug_print("Window class: " .. get_window_class())

for class, ws in pairs(app_rules) do
    if (string.lower(get_window_class()) == class) then
        set_window_workspace(ws)
        -- Uncomment kalau mau langsung pindah ke workspace itu:
        -- change_workspace(ws)
    end
end
