# Phase 4 — Learning Engine

## Layout (Course Player)

Fixed composition (do not redesign):

1. Left — Lesson navigation  
2. Center — PDF / Video viewer  
3. Right — Progress panel  
4. Bottom — Previous / Next  

## Tracking events

Reading time, visited pages, scroll %, current page, resume position,  
video watch %, pause, seek, playback speed, tab hidden, window blur, idle time.

## Assignment statuses

`NOT_STARTED` · `IN_PROGRESS` · `COMPLETED`  
(Overdue is a derived flag when due date passed and not completed.)

## Admin flow to seed learner work

1. Publish course  
2. Add assignment rules  
3. Click **Assign to learners** (apply-rules)  

## Employee routes

- `/app/my-learning` — assigned courses dashboard  
- `/app/learn/:assignmentId` — course player  

## Excluded

- Quiz engine  
- Reporting dashboards beyond employee summary  
