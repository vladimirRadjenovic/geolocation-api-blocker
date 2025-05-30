$ArchiveName = "geolocation-api-blocker.zip"
if(Test-Path $ArchiveName){
    Remove-Item $ArchiveName
}
Compress-Archive -Path .\manifest.json , .\popup , .\options , .\modules , 
.\leaflet , .\js , .\icons , .\fonts , .\css -DestinationPath $ArchiveName