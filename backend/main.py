from fastapi import FastAPI, Depends , HTTPException
#import fastapi so that python can create a web api.
from backend.schemas import Report,Reporttype,ReportResponse

#Now ,we want to sure that our API endpoints get access to the Session-->database.
#get_db is the function which contais db which is an object of sessionLocal() and it calls it
from backend.database import get_db
#Session is us doing groundwork and saying we are going to ensure sessions to our endpoints here.
from sqlalchemy.orm import Session

from backend.models import ReportModel

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
#this creates our fastapi application.
details = {
    "project":"TRAC",
    "purpose":"Tourism disaster coordination"
}
reports_response = {
    "message":"Report received"
}
@app.put("/reports/{report_id}",response_model=ReportResponse)
def update_report(report_id:int , to_update_report: Report, db:Session = Depends(get_db)):
    existing_report = db.query(ReportModel).filter(ReportModel.id ==report_id).first()


    if existing_report is None:
        raise HTTPException(
            status_code=404,
            detail="Report not found"
        )
    #now , here after making sure existing_report is actually in the database.
    #we need to replace the data of the attributes of this report .
    existing_report.type = to_update_report.type
    existing_report.message=to_update_report.message
    existing_report.location=to_update_report.location
    #doing only this much doesnt actuallyy permanently cause save changes to the postgre table.
    #cause we have shown the system here that : we have made changes to the object of ours.
    #but we havent yet committed it yet.

    #doing the same for latitude and longitude
    existing_report.latitude = to_update_report.latitude
    existing_report.longitude = to_update_report.longitude
    db.commit()
    return existing_report

@app.get("/") 
#when someone sends a get request to /
#use the function below.
def home():
    return{"message":"TRAC is running"}

@app.get("/about")
def about():
    return details

@app.get("/reports/{report_id}", response_model=ReportResponse)
# here we are saying this endpoint returns one report,
# and that response/response_model must follow the ReportResponse schema.

def retrieve_reports(report_id: int, db: Session = Depends(get_db)):

    report_records = db.query(ReportModel).filter(ReportModel.id == report_id).first()

    if report_records is None:
        raise HTTPException(
            status_code=404,
            detail="Report Not Found"
        )

    # report_id comes from the URL: /reports/{report_id}
    # We query ReportModel, which is mapped to the "reports" table.
    # Then we filter the table based on its id.
    # We compare the id in the database with the report_id
    # that came from the URL.
    # If they match, .first() gives us that report.

    #after following the schema you will get your data from here.

   #report_records =db.query(ReportModel).all()
   #This would have gave us all the details of ReportModel after querying ....

    return report_records
    
    #This means ; use this query session to query the table represented by ReportModel

@app.get("/reports", response_model=list[ReportResponse])
def retrieve_all_reports(type:Reporttype | None = None, 
                         location :str |None= None,
                         db:Session = Depends(get_db)):
    query = db.query(ReportModel)

    if type is not None:
        query = query.filter(ReportModel.type ==type)
    if location is not None:
        query = query.filter(ReportModel.location.ilike(location))

        # here we replaced == with ilike ... what ilike does it looks for 
        # similarity patterns between ReportModel.Location and location.

        #for example: the user enters pokhara and our database Contains Pokhara..
        #nowe due to the ilike it looks for pattern.. and since pokhara is quite similar to Pokhara... it will show the same .. 

    report_records = query.all()
    return report_records




@app.post("/reports", response_model = ReportResponse)
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
        location = report.location,
        latitude = report.latitude,
        longitude = report.longitude
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
    return new_report


@app.delete("/reports/{report_id}")
def delete_reports(report_id:int , db:Session=Depends(get_db)):
    existing_report = db.query(ReportModel).filter(ReportModel.id == report_id).first()

    if existing_report is None:
        raise HTTPException(
            status_code = 404,
            detail= "Report not found"
        )

    db.delete(existing_report)
    db.commit()
    return {"Message": "Report Deleted Succesfully!!"}