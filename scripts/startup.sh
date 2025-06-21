#!/bin/bash


# Tunggu beberapa detik supaya window terbuka
sleep 3

# Pindahkan ke desktop tertentu (desktop dimulai dari 0)
wmctrl -r konsole -t 0       # Desktop 1
wmctrl -r "Visual Studio Code" -t 1   # Desktop 2
wmctrl -r "Google Chrome" -t 2        # Desktop 3
