# $Id$

All: jpeg_streamer

jpeg_streamer: jpeg_streamer.c
	gcc -o jpeg_streamer -O2 -I/opt/local/include/ jpeg_streamer.c -lcv -lcvaux -lcxcore -lhighgui -L/opt/local/lib -levent -lpthread

clean:
	rm -f *~ jpeg_streamer

# EOF
