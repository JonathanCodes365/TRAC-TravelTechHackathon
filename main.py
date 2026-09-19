from fastapi import FastAPI
#import fastapi so that python can create a web api.
from schemas import Report,Reporttype

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
def receive_reports(report:Report):
    #This function is actually telling us: Take the incoming request from the body 
    #and put it into the report variable after validating as a Report.
    if report.type  == Reporttype.RESCUE:
        print("This is an rescue alert!")
    else:
        print("XYZ")

    print(report.type)
    
    print(report.message)
    print(report.location)
    return report