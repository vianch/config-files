#!/bin/bash
# source bestdayever.sh to run greet
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
  sleep 0.5
function greet() {
  name=${1:-"VIANCH"} 
  compliments=${2:-"Good"}
  city=${3:-"BOGOTA"}
  user=$(whoami)
  date=$(date)
  whereamlocated=$(dig +short myip.opendns.com @resolver1.opendns.com)
  #neofetch
  sleep 0.5
  echo "Hi $name! your looking $compliments "
  echo "Current date: $date"
  curl -s  "wttr.in/london?0?A?m"
}