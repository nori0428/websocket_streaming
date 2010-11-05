/**
 * $Id$
 **/

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <netdb.h>
#include <time.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <event.h>
#include <pthread.h>
#include <opencv/cxcore.h>
#include <opencv/cv.h>
#include <opencv/highgui.h>

#define	BACKLOG			(5)
#define	PORTNUM			"9000"

struct client {
    int fd;
    struct event ev;
    struct client *next;
};

struct client *gHead_client = NULL;
unsigned char json[65535];

pthread_mutexattr_t gMutexAttr;
pthread_mutex_t gMutex;

void
b64_encode(unsigned char *dst, const unsigned char *src, size_t siz) {
    const unsigned char *base64 = (unsigned char *)"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    unsigned char *p = (char *)src;
    unsigned long x = (unsigned long)0;
    int i = 0, l = 0;

    for (; siz > 0; p++, siz--) {
        x = x << 8 | *p;
        for (l += 8; l >= 6; l -= 6) {
            dst[i++] = base64[(x >> (l - 6)) & 0x3f];
        }
    }
    if (l > 0) {
        x <<= 6 - l;
        dst[i++] = base64[x & 0x3f];
    }
    for (; i % 4;) {
        dst[i++] = '=';
    }
    return;
}

int
tcp_listen(const char *service) {
    struct addrinfo hints;
    struct addrinfo *res = NULL;
    struct addrinfo *ai = NULL;
    int sockfd;
    int on = 1;

    memset(&hints, 0, sizeof(hints));
    hints.ai_family = AF_INET6;
    hints.ai_socktype = SOCK_STREAM;
    hints.ai_flags = AI_PASSIVE;

    if (getaddrinfo(NULL, service, &hints, &res) != 0) {
        return -1;
    }
    ai = res;
    sockfd = socket(ai->ai_family, ai->ai_socktype, ai->ai_protocol);
    if (sockfd < 0) {
        return -1;
    }
    if (setsockopt(sockfd, SOL_SOCKET, SO_REUSEADDR, &on, sizeof(on)) < 0) {
        return -1;
    }
    if (bind(sockfd, ai->ai_addr, ai->ai_addrlen) < 0) {
        return -1;
    }
    if (listen(sockfd, BACKLOG) < 0) {
        return -1;
    }
    freeaddrinfo(res);
    return sockfd;
}

static void
read_handler(int fd, short event, void *arg) {
    ssize_t i, siz;
    char buf[4096];
    struct client *c = NULL;
    struct client *prev = NULL;

    if (event & EV_READ) {
        memset(buf, 0 ,sizeof(buf));
        if ((siz = read(fd, buf, sizeof(buf))) <= 0 ) {
            pthread_mutex_lock(&gMutex);
            c = (struct client *)arg;
            prev = gHead_client;
            event_del(&c->ev);
            for (c = gHead_client; c ; c = c->next) {
                if (fd == c->fd) {
                    break;
                }
                prev = c;
            }
            if (c == gHead_client) {
                gHead_client = c->next;
            } else {
                prev->next = c->next;
            }
            pthread_mutex_unlock(&gMutex);
            fprintf(stdout, "finished fd = [%d]\n", fd);
            close(fd);
            free(c);
        }
    }
}

static void
accept_handler(int fd, short event, void *arg) {
    struct sockaddr_storage sa;
    socklen_t len = sizeof(sa);
    struct client *new_client;
    struct client *p = NULL;

    if (event & EV_READ) {
        new_client = malloc(sizeof(struct client));
        new_client->fd = accept(fd, (struct sockaddr *)&sa, &len);
        new_client->next = NULL;
        pthread_mutex_lock(&gMutex);
        p = gHead_client;
        if (!p) {
            gHead_client = new_client;
        } else {
            for (; p->next; p = p->next) {
                ;
            }
            p->next = new_client;
        }
        event_set(&new_client->ev, new_client->fd,
                  EV_READ|EV_PERSIST, read_handler, new_client);
        event_add(&new_client->ev, NULL);
        pthread_mutex_unlock(&gMutex);
        fprintf(stdout, "accepted = %d\n", new_client->fd);
    }
}

void *
ev_server() {
    int fd;
    struct event ev;

    fd = tcp_listen(PORTNUM);
    event_init();
    event_set(&ev, fd, EV_READ|EV_PERSIST, accept_handler, &ev);
    event_add(&ev, NULL);
    event_dispatch();
}

int
my_main(int argc, char *argv[]) {
    pthread_t tid;
    CvCapture *capture;
    IplImage *image, *jpg;
    CvMat *mat;
    int p[] = {CV_IMWRITE_JPEG_QUALITY, 50};
    double t = 0.0, f = (double)cvGetTickFrequency() * 1000.0;
    int wait_ms = 1;
    double fps = 0.0;
    unsigned char b64_jpg[65535];
    size_t len;
    struct client *c;

    if (argc > 1) {
        wait_ms = atoi(argv[1]);
    }
    fprintf(stderr, "wait: %dms\n", wait_ms);
    if (pthread_create(&tid, NULL, ev_server, (void *)NULL) !=0) {
        fprintf(stderr, "fail to create thread\n");
        return -1;
    }
    if ((capture = cvCreateCameraCapture(-1)) == NULL) {
        fprintf(stderr, "not found cam.\n");
        return -1;
    }
    pthread_mutexattr_init(&gMutexAttr);
    pthread_mutex_init(&gMutex, &gMutexAttr);
    cvNamedWindow("local view", CV_WINDOW_AUTOSIZE);
    
    while (1) {
        t = (double)cvGetTickCount();
        do {
            image = cvQueryFrame(capture);
        } while (!image);
        mat = cvEncodeImage(".jpg", image, p);
        memset(b64_jpg, 0, sizeof(b64_jpg));
        b64_encode(b64_jpg, mat->data.ptr, mat->step);
        memset(json, 0, sizeof(json));
        if (fps != 0.0) {
            snprintf(json, sizeof(json),
                     "{\"fps\":%.02lf, \"jpg\":\"data:image/jpeg;base64,%s\"}",
                     fps, b64_jpg);
        }
        pthread_mutex_lock(&gMutex);
        c = gHead_client;
        if (c) {
            len = strlen(json);
            do {
                write(c->fd, json, len);
                c = c->next;
            } while(c);
        }
        pthread_mutex_unlock(&gMutex);
        cvWaitKey(wait_ms);
        t = (double)cvGetTickCount() - t;
        fps = 1000.0 / (t / ((double)cvGetTickFrequency() * 1000.0));
#if 0
        fprintf(stderr, "%.2lf\n", fps);
#endif

#if 0
        jpg = cvDecodeImage(mat, 1);
        cvShowImage("local view", jpg);
#else
        cvShowImage("local view", image);
#endif
    }
    cvDestroyWindow("local view");
    return 0;
}

int
main(int argc, char *argv[]) {
    return cvInitSystem(argc, argv, my_main);
}

/* EOF */
