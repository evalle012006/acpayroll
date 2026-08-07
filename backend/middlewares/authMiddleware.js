const jwt = require("jsonwebtoken");
const pool = require("../db");

const normalizeRole=(role)=>String(role||"").trim().toLowerCase();
const normalizeDepartment=(v)=>String(v||"").trim().toLowerCase();

const getBearerToken=(req)=>{
  const header=req.headers.authorization||req.headers.Authorization||"";
  const raw=String(header);

  if(raw.toLowerCase().startsWith("bearer ")){
    return raw.slice(7).trim();
  }

  return null;
};

const requireAuth=async(req,res,next)=>{
  const token=getBearerToken(req);

  if(!token){
    return res.status(401).json({message:"Missing token"});
  }

  if(!process.env.JWT_SECRET){
    return res.status(500).json({message:"JWT_SECRET is missing"});
  }

  try{
    const decoded=jwt.verify(token,process.env.JWT_SECRET);

    const userId=Number(decoded?.id);

    if(!Number.isFinite(userId)||userId<=0){
      return res.status(401).json({message:"Invalid token"});
    }

    const result=await pool.query(
      `
      SELECT
        u.id,
        u.username,
        u.role,
        u.department,
        u.branch_id,
        u.area,
        u.region,
        u.division,
        u.status,
        u.first_name,
        u.middle_name,
        u.last_name,

        COALESCE(
          ARRAY_AGG(
            DISTINCT uds.department
          ) FILTER (
            WHERE uds.department IS NOT NULL
          ),
          ARRAY[]::TEXT[]
        ) AS department_scopes

      FROM public.users u

      LEFT JOIN public.user_department_scopes uds
        ON uds.user_id=u.id

      WHERE u.id=$1

      GROUP BY
        u.id,
        u.username,
        u.role,
        u.department,
        u.branch_id,
        u.area,
        u.region,
        u.division,
        u.status,
        u.first_name,
        u.middle_name,
        u.last_name

      LIMIT 1
      `,
      [userId]
    );

    if(result.rows.length===0){
      return res.status(401).json({message:"User not found"});
    }

    const user=result.rows[0];

    if(String(user.status||"Active").trim().toLowerCase()==="inactive"){
      return res.status(403).json({
        message:"This account is inactive"
      });
    }

    const departmentScopes=Array.isArray(user.department_scopes)
      ? user.department_scopes.filter(Boolean)
      : [];

    const primaryDepartment=String(user.department||"").trim();

    const hasPrimary=departmentScopes.some(
      (d)=>normalizeDepartment(d)===normalizeDepartment(primaryDepartment)
    );

    if(primaryDepartment&&!hasPrimary){
      departmentScopes.push(primaryDepartment);
    }

    req.user={
      ...decoded,

      id:user.id,
      username:user.username,
      role:normalizeRole(user.role),

      department:user.department||null,
      department_scopes:departmentScopes,

      branch_id:user.branch_id??null,
      area:user.area||null,
      region:user.region||null,
      division:user.division||null,

      first_name:user.first_name||null,
      middle_name:user.middle_name||null,
      last_name:user.last_name||null,
      status:user.status||"Active",
    };

    return next();
  }catch(err){
    console.error("requireAuth ERROR:",err.message);

    if(
      err?.name==="JsonWebTokenError"||
      err?.name==="TokenExpiredError"
    ){
      return res.status(401).json({message:"Invalid token"});
    }

    return res.status(500).json({message:"Authentication error"});
  }
};

const requireRole=(roles=[],options={adminOverride:true})=>{
  const allowed=Array.isArray(roles)?roles:[roles];
  const allowedNormalized=allowed.map(normalizeRole).filter(Boolean);
  const adminOverride=options?.adminOverride!==false;

  return(req,res,next)=>{
    const userRole=normalizeRole(req.user?.role);

    if(!userRole){
      return res.status(403).json({message:"Access denied"});
    }

    if(adminOverride&&userRole==="admin"){
      return next();
    }

    if(!allowedNormalized.includes(userRole)){
      return res.status(403).json({message:"Access denied"});
    }

    return next();
  };
};

const hasDepartmentScope=(user,department)=>{
  const target=normalizeDepartment(department);

  if(!target){
    return false;
  }

  const primary=normalizeDepartment(user?.department);

  if(primary===target){
    return true;
  }

  const scopes=Array.isArray(user?.department_scopes)
    ? user.department_scopes
    : [];

  return scopes.some(
    (departmentScope)=>
      normalizeDepartment(departmentScope)===target
  );
};

module.exports={
  requireAuth,
  requireRole,
  normalizeRole,
  normalizeDepartment,
  hasDepartmentScope,
};