#!/bin/bash
# ENABLE THIS BASH FILE FOR YOUR USER
# sudo cp bestdayever.sh /etc/profile.d/bestdayever.sh

# DISABLE ALL MOTD LOGIN MESSAGES
#sudo chmod -x /etc/update-motd.d/*

# ENABLE MOTD LOGIN MESSAGES
#sudo chmod +x /etc/update-motd.d/*

# CUSTOM MESSAGE 
# sudo nano /etc/update-motd.d/01-custom
# sudo chmod +x /etc/update-motd.d/01-custom

# Print last login SSH
# sudo nano /etc/ssh/ssh_config
# sudo nano /etc/ssh/sshd_config
# PrintLastLog yes
# service ssh restart

#name="Victor"
#read name

# $1
name=${1:-"Victor"} 
# $2
compliments=${2:-"Good"}
user=$(whoami)
date=$(date)
whereami=$(pwd)
lastlogin=$(last -1 -R  $USER | head -1 | cut -c 20-)
#curl ifconfig.me
#curl -4/-6 icanhazip.com
#curl ipinfo.io/ip
#curl api.ipify.org
#curl checkip.dyndns.org
#dig +short myip.opendns.com @resolver1.opendns.com
#host myip.opendns.com resolver1.opendns.com
#curl ident.me
#curl bot.whatismyipaddress.com
#curl ipecho.net/plain
#curl checkip.amazonaws.com
whereamlocated=$(dig +short myip.opendns.com @resolver1.opendns.com)

neofetch
sleep 0.5
echo "Hi $name! your looking $compliments "
echo " "
echo "You're currently logged in as $user and you're in the directory $whereami."
echo "Current date: $date"
echo "Last login time:$lastlogin"
echo " "
echo "Your internet ip: $whereamlocated and your local ip: $(hostname -I | awk '{print $1}')"
echo "Raspberry pi temp: $(vcgencmd measure_temp | grep  -o -E '[[:digit:]].*')"
echo " "
echo "$(curl -s  wttr\.in/"BOGOTA"?0?A?m)"
