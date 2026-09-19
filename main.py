from fastapi import FastAPI, Depends
#import fastapi so that python can create a web api.
from schemas import Report,Reporttype

#Now ,we want to sure that our API endpoints get access to the Session-->database.
#get_db is the function which contais db which is an object of sessionLocal() and it calls it
from database import get_db
#Session is us doing groundwork and saying we are going to ensure sessions to our endpoints here.
from sqlalchemy.orm import Session

from models import ReportModel

app = FastAPI()
#this creates our fastapi application.

@app.get("/")
#when someone sends a get request to /
#use the function below.
def home():
    return{"message":"TRAC is running"}

details = {
    "project":"TRAC",
    "purpose":"Tourism disaster coordination"
}

reports_response = {
    "message":"Report received"
}


@app.get("/about")
def about():
    return details


@app.post("/reports")
def receive_reports(report:Report,
                    db: Session = Depends(get_db)):
    
    #This function is actually telling us: Take the incoming request from the body 
    #and put it into the report variable after validating as a Report(pydantic with Report).

    #db: Session =Depends(get_db)
    #It means FastApi , give this endpoint a SQLAlchemySession by running get_db.

    #Depends is a FastAPI injection mechanism .
    #For example here we can see Depends(get_db) it means: go inside get_db and get me everything.
    #Using depends allows us to be as efficient as possible and allows us to add the session code in wherever
    #we want with just applying depends(...)


    if report.type  == Reporttype.RESCUE:
        print("This is an rescue alert!")
    else:
        print("XYZ")

    print(report.type)
    #this gives our enum member..
    #we have explicitly stated type to be Reporttype.. in our schemas.py
    
    print(report.message)
    print(report.location)
    #ReportModel is from our models.py which means it is a SQL alchemy model
    #since we are doing new_report = ReportModel(....)
    #This means we are making new_report it's object and calling it ...
    new_report = ReportModel(
        #this report are the values we get after pydantic model does it work
        type = report.type,
        message = report.message,
        location = report.location
        #so we are telling the system this is our database model for receive_report and this is how it must seem.
    )

    #before db.add.... we have created a SQLAlchemy object and have not done yet anything in PostgreSQL yet..
    db.add(new_report)
    #we know db represents session.
    #so this code does is ... Session ; start tracking this object new_report 
    # because i want it to become a database record.
    #but still notice that we are only tracking and there 
    # is no thing yet that we have pushed .. we use commit for this.
    db.commit()
    return report