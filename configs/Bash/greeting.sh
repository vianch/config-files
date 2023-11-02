#!/bin/bash

function greet() {
  name=${1:-"VIANCH"} 
  compliments=${2:-"Good"}
  city=${3:-"BOGOTA"}
  user=$(whoami)
  date=$(date)
  whereamlocated=$(dig +short myip.opendns.com @resolver1.opendns.com)

  sleep 0.5
  echo "Hi $name! your looking $compliments "
  echo "Current date: $date"
  curl -s  "wttr.in/london?0?A?m"
}