#!/bin/bash

# remove leading 0x00 from arguments
arg1=$(echo $1 | sed 's/^0x0*//')
arg2=$(echo $2 | sed 's/^0x0*//')
echo $arg1,$arg2 >> www/waiting.csv
