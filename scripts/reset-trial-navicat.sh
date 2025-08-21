#!/bin/bash

# Author: NakamuraOS <https://github.com/nakamuraos>
# Latest update: 06/24/2024
# Tested on Navicat 15.x, 16.x, 17.x on Debian, Ubuntu.

BGRED="\e[1;97;41m"
ENDCOLOR="\e[0m"

echo "Starting reset..."
DATE=$(date '+%Y%m%d_%H%M%S')
# Backup
echo "=> Creating a backup..."
cp ~/.config/dconf/user ~/.config/dconf/user.$DATE.bk
echo "The user dconf backup was created at $HOME/.config/dconf/user.$DATE.bk"
cp ~/.config/navicat/Premium/preferences.json ~/.config/navicat/Premium/preferences.json.$DATE.bk
echo "The Navicat preferences backup was created at $HOME/.config/navicat/Premium/preferences.json.$DATE.bk"
# Clear data in dconf
echo "=> Resetting..."
dconf reset -f /com/premiumsoft/navicat-premium/
echo "The user dconf data was reset"
# Remove data fields in config file
sed -i -E 's/,?"([A-F0-9]+)":\{([^\}]+)},?//g' ~/.config/navicat/Premium/preferences.json
echo "The Navicat preferences was reset"
# Done
echo "Done."
