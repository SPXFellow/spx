cd /home/spx/
git pull origin
pkill -f run.sh
screen -D spx
screen -r spx
sh ./run.sh