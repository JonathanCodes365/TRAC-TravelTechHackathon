from fastapi import FastAPI
#import fastapi so that python can create a web api.
from pydantic import BaseModel
#for validation
from typing import Optional
#for optional data.

app = FastAPI()
#this creates our fastapi application.

class Report(BaseModel):
    type:str
    message:str

    #it is not necessary for the users to know the location?
    #he/she might be a tourist ?
    location:optional[str]=None

#here we create our pydantic checking for the incoming info:





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
    if report.type  == "rescue":
        print("This is an rescue alert!")
    else:
        print("XYZ")

    print(report.type)
    print(report.message)
    print(report.location)
    return report